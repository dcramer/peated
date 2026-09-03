import config from "@peated/server/config";
import { db } from "@peated/server/db";
import {
  bottles,
  externalReviews,
  externalSiteRuns,
  memberReviews,
} from "@peated/server/db/schema";
import { loadScoredExternalReviews } from "@peated/server/externalReviews/scoredReviews";
import { isAIGatewayConfigured } from "@peated/server/lib/openaiClient";
import { installInMemoryWorkerDispatch } from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import {
  getConnection,
  getQueue,
  gracefulShutdown,
  startWorkerRuntime,
  useQueueWorkerDispatch,
  type WorkerRuntime,
} from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { AI_INSTRUCTIONS_VERSION } from "./setupAgent";
import { reviewWebsites, startReviewWebsite } from "./testWebsites";

let fixtureWebsite: Awaited<ReturnType<typeof startReviewWebsite>> | undefined;
let workerRuntime: WorkerRuntime;

async function clearQueue(queue: WorkerRuntime["queues"][number]) {
  await queue.obliterate({ force: true });
}

async function waitForWorker() {
  const deadline = Date.now() + 290_000;
  let idleChecks = 0;
  while (Date.now() < deadline) {
    const counts = await Promise.all(
      workerRuntime.queues.map(async (queue) => ({
        pending: await queue.getJobCountByTypes(
          "active",
          "delayed",
          "prioritized",
          "waiting",
          "waiting-children",
        ),
        failed: await queue.getFailedCount(),
      })),
    );
    if (counts.every(({ pending }) => pending === 0)) {
      idleChecks += 1;
      if (idleChecks === 2) {
        if (counts.some(({ failed }) => failed > 0)) {
          throw new Error(`Worker job failed: ${JSON.stringify(counts)}`);
        }
        return;
      }
    } else {
      idleChecks = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Worker queues did not become idle before the test timeout.");
}

describe.skipIf(!isAIGatewayConfigured("scraper"))(
  "create scraper with the real model",
  () => {
    beforeAll(async () => {
      const connection = await getConnection();
      const queues = await Promise.all([
        getQueue("default", connection),
        getQueue("scrapers", connection),
      ]);
      await Promise.all(queues.map(clearQueue));
      await Promise.all(queues.map((queue) => queue.close()));
      useQueueWorkerDispatch();
      workerRuntime = await startWorkerRuntime();
    });
    afterAll(async () => {
      await workerRuntime.close();
      await gracefulShutdown();
      installInMemoryWorkerDispatch();
    });
    afterEach(async () => {
      await fixtureWebsite?.close();
      fixtureWebsite = undefined;
    });
    beforeEach(() => {
      const clipsEnabled = config.EXTERNAL_REVIEW_CLIPS_ENABLED;
      config.EXTERNAL_REVIEW_CLIPS_ENABLED = false;
      return () => {
        config.EXTERNAL_REVIEW_CLIPS_ENABLED = clipsEnabled;
      };
    });

    for (const website of reviewWebsites) {
      test(`creates and collects ${website.key} reviews from a homepage URL`, async ({
        fixtures,
      }) => {
        fixtureWebsite = await startReviewWebsite(website);
        const { origin, requestedPages } = fixtureWebsite;
        const admin = await fixtures.User({ admin: true });
        const context = { context: { user: admin } };
        const bottleIds: number[] = [];
        for (const review of website.reviews) {
          const bottle = await fixtures.Bottle();
          bottleIds.push(bottle.id);
          await fixtures.BottleReference({
            name: review.name,
            bottleId: bottle.id,
          });
          await db
            .insert(memberReviews)
            .values({ bottleId: bottle.id, createdById: admin.id, score: 91 });
        }

        const source = await routerClient.externalSites.scrapeSources.create(
          {
            name: website.name,
            kind: "review",
            websiteUrl: `${origin}/`,
          },
          context,
        );
        expect(source).toMatchObject({
          enabled: false,
          activeRevisionId: null,
          setup: { status: "queued" },
        });
        await waitForWorker();
        const [suggested] = await routerClient.externalSites.scrapeSources.list(
          { site: source.site.type },
          context,
        );
        expect(suggested.setup).toMatchObject({
          status: "succeeded",
          error: null,
        });
        expect(suggested.revisions).toHaveLength(1);
        const revision = suggested.revisions[0];
        expect(revision).toMatchObject({
          author: "ai",
          aiModel: config.SCRAPER_SETUP_MODEL,
          aiInstructionsVersion: AI_INSTRUCTIONS_VERSION,
          previewStatus: "pending",
          active: false,
        });
        expect(await db.select().from(externalReviews)).toEqual([]);

        const revisionInput = { id: source.id, revisionId: revision.id };
        await expect(
          routerClient.externalSites.scrapeSources.activate(
            revisionInput,
            context,
          ),
        ).rejects.toThrow("Preview this version successfully");
        await routerClient.externalSites.scrapeSources.preview(
          revisionInput,
          context,
        );
        await waitForWorker();
        const [previewed] = await routerClient.externalSites.scrapeSources.list(
          { site: source.site.type },
          context,
        );
        const preview = previewed.revisions[0].previewResult;
        expect(previewed.revisions[0].previewStatus).toBe("passed");
        expect(preview.issues).toEqual([]);
        expect(preview.pages).toHaveLength(
          new Set(website.reviews.map((review) => review.url)).size,
        );
        const previewReviews = preview.pages.flatMap((page) => {
          if (page.kind !== "review") throw new Error("Expected review pages.");
          return page.reviews.map((review) => ({
            ...review,
            url: page.url,
            publishedAt: page.publishedAt,
          }));
        });
        expect(previewReviews).toHaveLength(website.reviews.length);
        for (const review of website.reviews) {
          expect(
            previewReviews.find((item) => item.name === review.name),
          ).toMatchObject({
            url: origin + review.url,
            publishedAt: review.publishedAt,
            reviewerName: review.reviewerName,
            nativeScore: {
              value: review.nativeScore.value,
              scale: review.nativeScore.scale,
              display: expect.any(String),
            },
          });
        }
        expect(await db.select().from(externalReviews)).toEqual([]);
        await routerClient.externalSites.scrapeSources.activate(
          revisionInput,
          context,
        );
        await routerClient.externalSites.reviewPublication.update(
          { site: source.site.type, publication: { approved: true } },
          context,
        );
        const run = await routerClient.externalSites.triggerJob(
          { site: source.site.type },
          context,
        );
        await waitForWorker();
        expect(
          await db.query.externalSiteRuns.findFirst({
            where: eq(externalSiteRuns.id, run.id),
          }),
        ).toMatchObject({ status: "succeeded", error: null });
        if (website.policy) {
          const scorePreview =
            await routerClient.externalSites.reviewScoring.preview(
              { site: source.site.type, policy: website.policy },
              context,
            );
          expect(scorePreview.samples).toHaveLength(website.reviews.length);
          await routerClient.externalSites.reviewScoring.update(
            {
              site: source.site.type,
              expectedVersion: scorePreview.version,
              policy: website.policy,
            },
            context,
          );
          await waitForWorker();
        }
        const stored = await loadScoredExternalReviews({
          siteId: source.site.id,
        });
        expect(stored).toHaveLength(website.reviews.length);
        for (const [index, review] of website.reviews.entries()) {
          expect(
            stored.find((item) => item.bottleId === bottleIds[index]),
          ).toMatchObject({
            name: review.name,
            url: origin + review.url,
            publishedAt: review.publishedAt,
            nativeScore: previewReviews.find(
              (item) => item.name === review.name,
            )!.nativeScore,
            contribution: {
              value: review.score,
              reason: review.score === null ? "excluded" : "counted",
            },
          });
          expect(
            await db.query.externalReviews.findFirst({
              where: eq(externalReviews.bottleId, bottleIds[index]),
            }),
          ).toMatchObject({ reviewerName: review.reviewerName });
          expect(
            await db.query.bottles.findFirst({
              where: eq(bottles.id, bottleIds[index]),
            }),
          ).toMatchObject({
            medianScore: review.score ?? 91,
            minScore: review.score ?? 91,
            maxScore: 91,
            memberScoreCount: 1,
            externalScoreCount: review.score === null ? 0 : 1,
          });
        }
        expect(requestedPages).toEqual(
          expect.arrayContaining([
            "/robots.txt",
            ...Object.keys(website.pages),
          ]),
        );
        await routerClient.externalSites.triggerJob(
          { site: source.site.type },
          context,
        );
        await waitForWorker();
        expect(
          await loadScoredExternalReviews({ siteId: source.site.id }),
        ).toEqual(stored);
      });
    }
  },
);
