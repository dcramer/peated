import { type AnyDatabase, type AnyTransaction, db } from "@peated/server/db";
import {
  externalReviewArticles,
  externalReviewBodies,
  externalReviewPublications,
  externalReviews,
  externalSiteRuns,
  externalSites,
  externalSiteScrapeTargets,
  scrapeOrigins,
  scrapeSourceRevisions,
  scrapeSourceRuns,
  scrapeSources,
  scrapeTargets,
} from "@peated/server/db/schema";
import { dispatchBottleStatsRecomputes } from "@peated/server/lib/dispatchBottleStatsRecompute";
import {
  ScrapeSourceCreateSchema,
  ScrapeSourceUrlSchema,
} from "@peated/server/schemas";
import { ExternalSiteKeySchema } from "@peated/server/schemas/externalSites";
import slugify from "@sindresorhus/slugify";
import { and, asc, desc, eq, inArray, isNull, max } from "drizzle-orm";
import { z } from "zod";
import {
  DEFAULT_SCRAPER_SETTINGS,
  getHourlyRequestSettings,
} from "../definitions";
import { ScraperRunTakenOverError } from "../session";
import type { ScrapeSourcePreviewResult } from "./preview";
import { reviewSourceKey } from "./reviewSourceKey";
import {
  SCRAPE_RULES_VERSION,
  type ScrapeRules,
  ScrapeRulesSchema,
} from "./rules";

const CreateScrapeSourceInputSchema = ScrapeSourceCreateSchema.extend({
  createdById: z.number().int().positive(),
}).strict();

export type CreateScrapeSourceInput = z.input<
  typeof CreateScrapeSourceInputSchema
>;

export class ScrapeSourceConflictError extends Error {
  override name = "ScrapeSourceConflictError";
}

export class ScrapeSourceNotFoundError extends Error {
  override name = "ScrapeSourceNotFoundError";
}

export class ScrapeSourceValidationError extends Error {
  override name = "ScrapeSourceValidationError";
}

export const SCRAPE_SOURCE_PAUSED_ERROR = "The source was paused.";

const DatabaseErrorSchema = z.object({ code: z.string() });
const ReviewSourceKeyPattern = /^review:[a-f0-9]{64}$/;

/** Keeps the original ID and visibility while carrying over a later scrape. */
async function keepOriginalReview(
  tx: AnyDatabase,
  original: typeof externalReviews.$inferSelect,
  newer: typeof externalReviews.$inferSelect,
) {
  if (
    original.bottleId !== null &&
    newer.bottleId !== null &&
    original.bottleId !== newer.bottleId
  ) {
    throw new ScrapeSourceValidationError(
      "Two copies of the same review point to different Bottles. Fix them before activating this version.",
    );
  }
  await tx
    .update(externalReviews)
    .set({
      bottleId: original.bottleId ?? newer.bottleId,
      name: newer.name,
      category: newer.category,
      reviewerName: newer.reviewerName,
      nativeScoreValue: newer.nativeScoreValue,
      nativeScoreScale: newer.nativeScoreScale,
      nativeScoreDisplay: newer.nativeScoreDisplay,
      clip: newer.clip,
      version: newer.version,
      tags: newer.tags,
    })
    .where(eq(externalReviews.id, original.id));

  const bodies = await tx
    .select()
    .from(externalReviewBodies)
    .where(
      inArray(externalReviewBodies.externalReviewId, [original.id, newer.id]),
    )
    .for("update");
  const originalBody = bodies.find(
    ({ externalReviewId }) => externalReviewId === original.id,
  );
  const newerBody = bodies.find(
    ({ externalReviewId }) => externalReviewId === newer.id,
  );
  if (
    newerBody &&
    (!originalBody || newerBody.fetchedAt >= originalBody.fetchedAt)
  ) {
    await tx
      .insert(externalReviewBodies)
      .values({ ...newerBody, externalReviewId: original.id })
      .onConflictDoUpdate({
        target: externalReviewBodies.externalReviewId,
        set: { body: newerBody.body, fetchedAt: newerBody.fetchedAt },
      });
  }

  return [original.bottleId, newer.bottleId].filter(
    (id): id is number => id !== null,
  );
}

/** Keeps original review IDs when new rules change how reviews are matched. */
// TODO(scraper): Remove this repair after every review source uses version 11
// and all saved reviews are matched by name and writer.
async function prepareReviewKeysForActivation(
  tx: AnyDatabase,
  externalSiteId: number,
) {
  const changedBottleIds = new Set<number>();
  const rows = await tx
    .select({ review: externalReviews })
    .from(externalReviews)
    .innerJoin(
      externalReviewArticles,
      eq(externalReviewArticles.id, externalReviews.articleId),
    )
    .where(eq(externalReviewArticles.externalSiteId, externalSiteId))
    .orderBy(asc(externalReviews.articleId), asc(externalReviews.id))
    .for("update");
  const reviewsByArticle = new Map<
    number,
    Array<(typeof rows)[number]["review"]>
  >();
  for (const { review } of rows) {
    const reviews = reviewsByArticle.get(review.articleId) ?? [];
    reviews.push(review);
    reviewsByArticle.set(review.articleId, reviews);
  }

  for (const reviews of reviewsByArticle.values()) {
    const oldKeyReviews = reviews.filter(
      ({ sourceKey }) => !sourceKey || !ReviewSourceKeyPattern.test(sourceKey),
    );
    const currentKeyReviews = reviews.filter(
      ({ sourceKey }) =>
        sourceKey !== null && ReviewSourceKeyPattern.test(sourceKey),
    );
    const reviewsToKeep = oldKeyReviews.length
      ? oldKeyReviews
      : currentKeyReviews;
    const expectedKeys = reviewsToKeep.map(({ name, reviewerName }) =>
      reviewSourceKey(name, reviewerName),
    );

    if (new Set(expectedKeys).size !== expectedKeys.length) {
      throw new ScrapeSourceValidationError(
        "Each review in an article must have a unique name and writer combination before this version can be activated.",
      );
    }
    if (
      currentKeyReviews.some(
        ({ sourceKey, name, reviewerName }) =>
          sourceKey !== reviewSourceKey(name, reviewerName),
      )
    ) {
      throw new ScrapeSourceValidationError(
        "This site has reviews that cannot be matched safely. Check them before activating this version.",
      );
    }

    if (oldKeyReviews.length && currentKeyReviews.length) {
      const currentReviewsByKey = new Map(
        currentKeyReviews.map((review) => [review.sourceKey, review]),
      );
      if (
        currentKeyReviews.length !== oldKeyReviews.length ||
        expectedKeys.some(
          (key, index) =>
            !currentReviewsByKey.has(key) ||
            currentReviewsByKey.get(key)!.id <= oldKeyReviews[index]!.id,
        )
      ) {
        throw new ScrapeSourceValidationError(
          "This site has reviews that cannot be matched safely. Check them before activating this version.",
        );
      }
      for (const [index, original] of oldKeyReviews.entries()) {
        const sourceKey = expectedKeys[index];
        const newer = sourceKey
          ? currentReviewsByKey.get(sourceKey)
          : undefined;
        if (!newer) throw new Error("Failed to find the newer review.");
        for (const bottleId of await keepOriginalReview(tx, original, newer)) {
          changedBottleIds.add(bottleId);
        }
      }
      await tx.delete(externalReviews).where(
        inArray(
          externalReviews.id,
          currentKeyReviews.map(({ id }) => id),
        ),
      );
    } else if (!oldKeyReviews.length) {
      continue;
    }

    for (const [index, review] of oldKeyReviews.entries()) {
      const expectedKey = expectedKeys[index];
      if (!expectedKey) throw new Error("Failed to prepare review keys.");
      await tx
        .update(externalReviews)
        .set({ sourceKey: expectedKey, updatedAt: new Date() })
        .where(eq(externalReviews.id, review.id));
    }
  }
  return [...changedBottleIds];
}

function exactOrigin(url: URL) {
  if (url.username || url.password) {
    throw new ScrapeSourceValidationError(
      "Source URLs cannot contain credentials.",
    );
  }
  return url.origin;
}

export function createSiteKey(websiteUrl: URL) {
  const hostname = websiteUrl.host.replace(/^www\./, "");
  const key = slugify(hostname).slice(0, 64).replace(/-+$/, "");
  return ExternalSiteKeySchema.parse(key);
}

export async function createSiteWithScrapeSource(
  rawInput: CreateScrapeSourceInput,
) {
  const input = CreateScrapeSourceInputSchema.parse(rawInput);
  const listUrl = new URL(input.websiteUrl);
  const origin = exactOrigin(listUrl);
  const key = createSiteKey(listUrl);
  for (const sample of input.sampleUrls) {
    if (exactOrigin(new URL(sample)) !== origin) {
      throw new ScrapeSourceValidationError(
        "Example pages must use the source website.",
      );
    }
  }

  try {
    return await db.transaction(async (tx) => {
      const [site] = await tx
        .insert(externalSites)
        .values({ type: key, name: input.name, runEvery: null })
        .returning();
      if (!site) throw new Error("Failed to create external site.");

      await tx.insert(scrapeTargets).values({
        key,
        managedBy: "admin",
        enabled: true,
        ...getHourlyRequestSettings(DEFAULT_SCRAPER_SETTINGS.requestsPerHour),
        timeoutMs: DEFAULT_SCRAPER_SETTINGS.timeoutMs,
        maxResponseBytes: DEFAULT_SCRAPER_SETTINGS.maxResponseBytes,
        maxRetries: DEFAULT_SCRAPER_SETTINGS.maxRetries,
      });
      await tx.insert(scrapeOrigins).values({
        origin,
        managedBy: "admin",
        targetKey: key,
        robotsMode: "enforce",
      });
      await tx.insert(externalSiteScrapeTargets).values({
        externalSiteId: site.id,
        targetKey: key,
        managedBy: "admin",
      });
      const [source] = await tx
        .insert(scrapeSources)
        .values({
          externalSiteId: site.id,
          kind: input.kind,
          listUrl: listUrl.toString(),
          sampleUrls: input.sampleUrls.map((value) =>
            new URL(value).toString(),
          ),
          createdById: input.createdById,
        })
        .returning();
      if (!source) throw new Error("Failed to create scrape source.");
      if (input.kind === "review") {
        await tx.insert(externalReviewPublications).values({
          externalSiteId: site.id,
        });
      }
      return { site, source };
    });
  } catch (error) {
    if (DatabaseErrorSchema.safeParse(error).data?.code === "23505") {
      throw new ScrapeSourceConflictError(
        "A source for this website already exists.",
      );
    }
    throw error;
  }
}

export type CreateScrapeSourceRevisionInput = {
  scrapeSourceId: number;
  listUrl?: string;
  rules: ScrapeRules;
  createdById: number;
} & (
  | { author: "person" }
  | { author: "ai"; aiModel: string; aiInstructionsVersion: string }
);

export async function createScrapeSourceRevision(
  input: CreateScrapeSourceRevisionInput,
) {
  const rules = ScrapeRulesSchema.parse(input.rules);
  return await db.transaction(async (tx) =>
    insertScrapeSourceRevision(tx, input, rules),
  );
}

async function insertScrapeSourceRevision(
  tx: AnyTransaction,
  input: CreateScrapeSourceRevisionInput,
  rules: ScrapeRules,
) {
  const [source] = await tx
    .select()
    .from(scrapeSources)
    .where(eq(scrapeSources.id, input.scrapeSourceId))
    .for("update");
  if (!source) throw new ScrapeSourceNotFoundError();
  const listUrl = ScrapeSourceUrlSchema.parse(input.listUrl ?? source.listUrl);
  if (exactOrigin(new URL(listUrl)) !== exactOrigin(new URL(source.listUrl))) {
    throw new ScrapeSourceValidationError(
      "The list page must stay on the source website.",
    );
  }
  if (source.kind !== rules.kind) {
    throw new ScrapeSourceValidationError(
      "The rules collect the wrong content.",
    );
  }
  const [latest] = await tx
    .select({ revision: max(scrapeSourceRevisions.revision) })
    .from(scrapeSourceRevisions)
    .where(eq(scrapeSourceRevisions.scrapeSourceId, source.id));
  const [revision] = await tx
    .insert(scrapeSourceRevisions)
    .values({
      scrapeSourceId: source.id,
      revision: (latest?.revision ?? 0) + 1,
      rulesVersion: SCRAPE_RULES_VERSION,
      listUrl: new URL(listUrl).toString(),
      rules,
      author: input.author,
      aiModel: input.author === "ai" ? input.aiModel : null,
      aiInstructionsVersion:
        input.author === "ai" ? input.aiInstructionsVersion : null,
      previewResult: { issues: [], pages: [] },
      createdById: input.createdById,
    })
    .returning();
  if (!revision) throw new Error("Failed to save the new rule version.");
  return revision;
}

export async function saveScrapeSourceSuggestion(
  input: CreateScrapeSourceRevisionInput & {
    externalSiteRunId: number;
    executionToken: string;
  },
) {
  const rules = ScrapeRulesSchema.parse(input.rules);
  return await db.transaction(async (tx) => {
    const [runState] = await tx
      .select({ run: externalSiteRuns, sourceRun: scrapeSourceRuns })
      .from(scrapeSourceRuns)
      .innerJoin(
        externalSiteRuns,
        eq(externalSiteRuns.id, scrapeSourceRuns.externalSiteRunId),
      )
      .where(
        and(
          eq(scrapeSourceRuns.externalSiteRunId, input.externalSiteRunId),
          eq(scrapeSourceRuns.scrapeSourceId, input.scrapeSourceId),
          eq(scrapeSourceRuns.purpose, "suggest"),
        ),
      )
      .for("update");
    if (!runState) throw new ScrapeSourceNotFoundError();
    if (
      runState.run.status !== "running" ||
      runState.run.executionToken !== input.executionToken
    ) {
      throw new ScraperRunTakenOverError();
    }
    if (runState.sourceRun.revisionId !== null) {
      const [revision] = await tx
        .select()
        .from(scrapeSourceRevisions)
        .where(eq(scrapeSourceRevisions.id, runState.sourceRun.revisionId));
      if (!revision) throw new ScrapeSourceNotFoundError();
      return revision;
    }

    const revision = await insertScrapeSourceRevision(tx, input, rules);
    const [linked] = await tx
      .update(scrapeSourceRuns)
      .set({ revisionId: revision.id })
      .where(
        and(
          eq(scrapeSourceRuns.externalSiteRunId, input.externalSiteRunId),
          isNull(scrapeSourceRuns.revisionId),
        ),
      )
      .returning({ externalSiteRunId: scrapeSourceRuns.externalSiteRunId });
    if (!linked) throw new ScraperRunTakenOverError();
    return revision;
  });
}

export async function listScrapeSources(siteKey?: string) {
  const query = db
    .select({ source: scrapeSources, site: externalSites })
    .from(scrapeSources)
    .innerJoin(
      externalSites,
      eq(externalSites.id, scrapeSources.externalSiteId),
    );
  return siteKey
    ? await query.where(eq(externalSites.type, siteKey))
    : await query.orderBy(externalSites.name, scrapeSources.kind);
}

export async function listScrapeSourceRevisions(scrapeSourceId: number) {
  return await db
    .select()
    .from(scrapeSourceRevisions)
    .where(eq(scrapeSourceRevisions.scrapeSourceId, scrapeSourceId))
    .orderBy(desc(scrapeSourceRevisions.revision));
}

export async function getLatestScrapeSourceSetup(scrapeSourceId: number) {
  const [setup] = await db
    .select({ run: externalSiteRuns })
    .from(scrapeSourceRuns)
    .innerJoin(
      externalSiteRuns,
      eq(externalSiteRuns.id, scrapeSourceRuns.externalSiteRunId),
    )
    .where(
      and(
        eq(scrapeSourceRuns.scrapeSourceId, scrapeSourceId),
        eq(scrapeSourceRuns.purpose, "suggest"),
      ),
    )
    .orderBy(desc(externalSiteRuns.createdAt))
    .limit(1);
  return setup?.run ?? null;
}

export async function recordScrapeSourcePreview(input: {
  runId: number;
  executionToken: string;
  revisionId: number;
  status: "passed" | "failed";
  result: ScrapeSourcePreviewResult;
}) {
  return await db.transaction(async (tx) => {
    const [runState] = await tx
      .select({ run: externalSiteRuns })
      .from(scrapeSourceRuns)
      .innerJoin(
        externalSiteRuns,
        eq(externalSiteRuns.id, scrapeSourceRuns.externalSiteRunId),
      )
      .where(
        and(
          eq(scrapeSourceRuns.externalSiteRunId, input.runId),
          eq(scrapeSourceRuns.revisionId, input.revisionId),
          eq(scrapeSourceRuns.purpose, "preview"),
        ),
      )
      .for("update");
    if (!runState) throw new ScrapeSourceNotFoundError();
    if (
      runState.run.status !== "running" ||
      runState.run.executionToken !== input.executionToken
    ) {
      throw new ScraperRunTakenOverError();
    }
    const [revision] = await tx
      .update(scrapeSourceRevisions)
      .set({
        previewStatus: input.status,
        previewResult: input.result,
        previewedAt: new Date(),
      })
      .where(eq(scrapeSourceRevisions.id, input.revisionId))
      .returning();
    if (!revision) throw new ScrapeSourceNotFoundError();
    return revision;
  });
}

export async function activateScrapeSourceRevision(input: {
  scrapeSourceId: number;
  revisionId: number;
}) {
  const activated = await db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(scrapeSources)
      .where(eq(scrapeSources.id, input.scrapeSourceId))
      .for("update");
    if (!source) throw new ScrapeSourceNotFoundError();

    const [revision] = await tx
      .select()
      .from(scrapeSourceRevisions)
      .where(
        and(
          eq(scrapeSourceRevisions.id, input.revisionId),
          eq(scrapeSourceRevisions.scrapeSourceId, source.id),
        ),
      );
    if (!revision) throw new ScrapeSourceNotFoundError();
    if (revision.previewStatus !== "passed") {
      throw new ScrapeSourceValidationError(
        "Preview this version successfully before you activate it.",
      );
    }

    // Run creation locks this row too, so no run can start after the check below.
    await tx
      .select({ id: externalSites.id })
      .from(externalSites)
      .where(eq(externalSites.id, source.externalSiteId))
      .for("update");
    const [activeRun] = await tx
      .select({ id: externalSiteRuns.id })
      .from(externalSiteRuns)
      .where(
        and(
          eq(externalSiteRuns.externalSiteId, source.externalSiteId),
          inArray(externalSiteRuns.status, ["queued", "running"]),
        ),
      )
      .limit(1);
    if (activeRun) {
      throw new ScrapeSourceValidationError(
        "Wait for the current run to finish before activating this version.",
      );
    }
    const changedBottleIds =
      source.kind === "review" && revision.rulesVersion === SCRAPE_RULES_VERSION
        ? await prepareReviewKeysForActivation(tx, source.externalSiteId)
        : [];

    await tx
      .update(scrapeSourceRevisions)
      .set({ active: false })
      .where(
        and(
          eq(scrapeSourceRevisions.scrapeSourceId, source.id),
          eq(scrapeSourceRevisions.active, true),
        ),
      );
    const [activeRevision] = await tx
      .update(scrapeSourceRevisions)
      .set({ active: true })
      .where(eq(scrapeSourceRevisions.id, revision.id))
      .returning();
    if (!activeRevision) throw new ScrapeSourceNotFoundError();

    const [enabledSource] = await tx
      .update(scrapeSources)
      .set({
        enabled: true,
        listUrl: activeRevision.listUrl,
        updatedAt: new Date(),
      })
      .where(eq(scrapeSources.id, source.id))
      .returning();
    if (!enabledSource) throw new ScrapeSourceNotFoundError();
    return {
      source: enabledSource,
      revision: activeRevision,
      changedBottleIds,
    };
  });
  await dispatchBottleStatsRecomputes(
    "externalReview",
    `scrapeSource:${input.scrapeSourceId}`,
    activated.changedBottleIds,
  );
  return { source: activated.source, revision: activated.revision };
}

export async function pauseScrapeSource(scrapeSourceId: number) {
  return await db.transaction(async (tx) => {
    // Lifecycle and Pause lock the site before touching collection runs. This
    // prevents a new run from being saved after Pause stops the current one.
    const [site] = await tx
      .select({ id: externalSites.id })
      .from(scrapeSources)
      .innerJoin(
        externalSites,
        eq(externalSites.id, scrapeSources.externalSiteId),
      )
      .where(eq(scrapeSources.id, scrapeSourceId))
      .for("update", { of: externalSites });
    if (!site) throw new ScrapeSourceNotFoundError();

    const completedAt = new Date();
    const [source] = await tx
      .update(scrapeSources)
      .set({ enabled: false, updatedAt: completedAt })
      .where(eq(scrapeSources.id, scrapeSourceId))
      .returning();
    if (!source) throw new ScrapeSourceNotFoundError();

    const [activeRun] = await tx
      .select({ id: externalSiteRuns.id })
      .from(externalSiteRuns)
      .innerJoin(
        scrapeSourceRuns,
        eq(scrapeSourceRuns.externalSiteRunId, externalSiteRuns.id),
      )
      .where(
        and(
          eq(scrapeSourceRuns.scrapeSourceId, source.id),
          eq(scrapeSourceRuns.purpose, "collect"),
          inArray(externalSiteRuns.status, ["queued", "running"]),
        ),
      )
      .for("update", { of: externalSiteRuns });
    if (!activeRun) return source;

    const [stoppedRun] = await tx
      .update(externalSiteRuns)
      .set({
        status: "failed",
        error: SCRAPE_SOURCE_PAUSED_ERROR,
        completedAt,
        nextAttemptAt: null,
        executionToken: null,
        executionExpiresAt: null,
      })
      .where(eq(externalSiteRuns.id, activeRun.id))
      .returning({ id: externalSiteRuns.id });
    if (!stoppedRun) throw new Error("Failed to stop the active scraper run.");

    await tx
      .update(externalSites)
      .set({ lastRunAt: completedAt, lastRunId: stoppedRun.id })
      .where(eq(externalSites.id, site.id));
    return source;
  });
}
