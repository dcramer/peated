import config from "@peated/server/config";
import { db } from "@peated/server/db";
import {
  externalReviewArticles,
  externalReviewBodies,
  externalReviews,
  externalSiteConfig,
  memberReviews,
} from "@peated/server/db/schema";
import { loadScoredExternalReviews } from "@peated/server/externalReviews/scoredReviews";
import { recomputeBottleStats } from "@peated/server/lib/recomputeBottleStats";
import { loadFixture } from "@peated/server/lib/test/fixtures";
import {
  REVIEW_SCORING_CONFIG_KEY,
  type ExternalReviewScoringPolicy,
} from "@peated/server/schemas/externalReviewScoring";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { parseDramfaceArticle } from "../adapters/dramface";
import { parseWhiskyNotesArticle } from "../adapters/whiskyNotes";
import { parseWordsOfWhiskyArticle } from "../adapters/wordsOfWhisky";
import { parseScrapeDetail } from "../configured/parser";
import { externalReviewSink } from "./externalReviews";

const wordsOfWhiskyPolicy: ExternalReviewScoringPolicy = {
  enabled: true,
  rules: [
    {
      scale: 10,
      guideUrl:
        "https://wordsofwhisky.com/thijs-klaverstijn-whisky-enthusiast-journalist/",
      explanation: "The publisher writes its 100-point scores as decimals.",
      from: null,
      until: null,
      points: [
        { source: 0, target: 0 },
        { source: 10, target: 100 },
      ],
    },
  ],
};

type CapturedReviewCase = {
  label: string;
  site: string;
  file: string;
  url: string;
  parse: typeof parseWordsOfWhiskyArticle;
  title: string;
  publishedAt: string;
  policy: ExternalReviewScoringPolicy | null;
  reviews: {
    name: string;
    reviewerName: string;
    nativeScore: { value: number; scale: number; display: string };
    contribution: { value: number | null; reason: "counted" | "excluded" };
  }[];
};

const wordsOfWhiskyCapture: CapturedReviewCase = {
  label: "Words of Whisky adapter",
  site: "wordsofwhisky",
  file: "ardbeg-ten-cask-strength-2026.html",
  url: "https://wordsofwhisky.com/ardbeg-ten-cask-strength-review",
  parse: parseWordsOfWhiskyArticle,
  title: "Ardbeg Ten Cask Strength (2026)",
  publishedAt: "2026-03-13T07:00:00.000Z",
  policy: wordsOfWhiskyPolicy,
  reviews: [
    {
      name: "Ardbeg Ten Cask Strength (61.7%, OB ‘Committee Exclusive, 2026)",
      reviewerName: "Thijs Klaverstijn",
      nativeScore: { value: 8.7, scale: 10, display: "8.7/10" },
      contribution: { value: 87, reason: "counted" },
    },
  ],
};

const captures: CapturedReviewCase[] = [
  wordsOfWhiskyCapture,
  {
    ...wordsOfWhiskyCapture,
    label: "Words of Whisky saved scraper rules",
    parse: (html, url) => {
      const result = parseScrapeDetail(
        {
          kind: "review",
          list: {
            detailLink: {
              selector: "article.category-tastingnotes a",
              attribute: "href",
            },
            maxItems: 20,
          },
          detail: {
            title: { selector: ".post-wrap .entry-title" },
            publishedAt: {
              selector: ".post-wrap time.entry-date",
              attribute: "datetime",
            },
            reviewItem: ".post-wrap .entry-content",
            name: { selector: "h2" },
            reviewerName: { selector: ".side-author__wrap .side-meta .title" },
            score: {
              value: { selector: ".lets-review-block__final-score" },
              scale: 10,
            },
          },
        },
        html,
        url,
      );
      expect(result.issues).toEqual([]);
      if (result.kind !== "review" || !result.value)
        throw new Error("Expected a parsed review.");
      return result.value;
    },
    reviews: wordsOfWhiskyCapture.reviews.map((review) => ({
      ...review,
      nativeScore: { ...review.nativeScore, display: "8.7" },
    })),
  },
  {
    label: "Dramface published score with a different hypothetical score",
    site: "dramface",
    file: "caol-ila-25-2024.html",
    url: "https://www.dramface.com/all-reviews/2024/caol-ila-25",
    parse: parseDramfaceArticle,
    title: "Caol Ila 25yo",
    publishedAt: "2024-01-08T00:00:00.000Z",
    policy: { enabled: false, rules: [] },
    reviews: [
      {
        name: "Caol Ila 25yo, Official bottling, 43% ABV",
        reviewerName: "Wally Macaulay",
        nativeScore: { value: 3, scale: 10, display: "3/10" },
        contribution: { value: null, reason: "excluded" },
      },
    ],
  },
  {
    label: "WhiskyNotes article with two different bottle scores",
    site: "whiskynotes",
    file: "ardnahoe-inaugural-infinite-loch-2025.html",
    url: "https://www.whiskynotes.be/2025/ardnahoe/ardnahoe-inaugural-release-infinite-loch/",
    parse: parseWhiskyNotesArticle,
    title: "Ardnahoe Inaugural release / Infinite Loch",
    publishedAt: "2025-05-02T01:32:05.000Z",
    policy: null,
    reviews: [
      {
        name: "Ardnahoe Inaugural release 5 yo (50%, OB 2024, bourbon + sherry casks)",
        reviewerName: "Ruben",
        nativeScore: { value: 88, scale: 100, display: "88/100" },
        contribution: { value: 88, reason: "counted" },
      },
      {
        name: "Ardnahoe Infinite Loch (50%, OB 2024, first-fill bourbon + first-fill Oloroso casks)",
        reviewerName: "Ruben",
        nativeScore: { value: 85, scale: 100, display: "85/100" },
        contribution: { value: 85, reason: "counted" },
      },
    ],
  },
];

describe("captured pages through review storage and score totals", () => {
  beforeEach(() => {
    const clipsEnabled = config.EXTERNAL_REVIEW_CLIPS_ENABLED;
    config.EXTERNAL_REVIEW_CLIPS_ENABLED = false;
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Captured review tests must not access the network."),
    );
    return () => {
      config.EXTERNAL_REVIEW_CLIPS_ENABLED = clipsEnabled;
    };
  });

  for (const capture of captures) {
    test(`preserves source scores and counts correctly for ${capture.label}`, async ({
      fixtures,
      defaults,
    }) => {
      const site = await fixtures.ExternalSite({ type: capture.site });
      await fixtures.ApprovedExternalReviewPublication({
        externalSiteId: site.id,
      });
      if (capture.policy) {
        await db.insert(externalSiteConfig).values({
          externalSiteId: site.id,
          key: REVIEW_SCORING_CONFIG_KEY,
          value: {
            version: 1,
            policy: capture.policy,
            recomputePending: false,
          },
        });
      }
      const bottleIds = [];
      for (const review of capture.reviews) {
        const bottle = await fixtures.Bottle();
        bottleIds.push(bottle.id);
        await fixtures.BottleReference({
          name: review.name,
          bottleId: bottle.id,
        });
        await db.insert(memberReviews).values({
          bottleId: bottle.id,
          createdById: defaults.user.id,
          score: 91,
        });
      }

      const parsed = capture.parse(
        await loadFixture(capture.site, capture.file),
        new URL(capture.url),
      );
      expect(parsed.article).toMatchObject({
        canonicalUrl: capture.url,
        title: capture.title,
        publishedAt: new Date(capture.publishedAt),
        externalReviews: capture.reviews.map(
          ({ contribution, ...review }) => review,
        ),
      });
      const observation = { sourceKey: capture.url, value: parsed };
      await externalReviewSink({ externalSiteId: site.id, observation });
      const firstImport = await loadScoredExternalReviews({ siteId: site.id });
      await externalReviewSink({ externalSiteId: site.id, observation });
      const replay = await loadScoredExternalReviews({ siteId: site.id });
      expect(replay).toEqual(firstImport);
      expect(replay).toHaveLength(capture.reviews.length);

      for (const [index, review] of capture.reviews.entries()) {
        const bottleId = bottleIds[index];
        expect(replay.find((item) => item.bottleId === bottleId)).toMatchObject(
          {
            name: review.name,
            nativeScore: review.nativeScore,
            contribution: review.contribution,
          },
        );
        const score = review.contribution.value;
        expect(await recomputeBottleStats(bottleId)).toMatchObject({
          medianScore: score ?? 91,
          minScore: score ?? 91,
          maxScore: 91,
          memberScoreCount: 1,
          externalScoreCount: score === null ? 0 : 1,
        });
      }
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  }
});

test("Whisky Advocate observations use article and source identity", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  await fixtures.ExternalReviewPublication({
    externalSiteId: site.id,
    approvedAt: null,
  });
  const bottle = await fixtures.Bottle({ name: "Sink Review Bottle" });
  const url = "https://whiskyadvocate.com/reviews/sink-review";
  const observation = {
    sourceKey: url,
    value: {
      article: {
        canonicalUrl: url,
        title: bottle.fullName,
        issue: "Fall 2026",
        publishedAt: new Date("2026-08-20T00:00:00.000Z"),
        contentHash: "first",
        externalReviews: [
          {
            sourceKey: url,
            name: bottle.fullName,
            category: bottle.category,
            reviewerName: null,
            nativeScore: { value: 92, scale: 100, display: "92/100" },
          },
        ],
      },
      externalReviewTexts: {},
      externalReviewBodies: {
        [url]:
          "A complete introduction.\n\nNose: vanilla.\n\nA final conclusion.",
      },
    },
  };

  await externalReviewSink({ externalSiteId: site.id, observation });
  await externalReviewSink({
    externalSiteId: site.id,
    observation: {
      ...observation,
      value: {
        ...observation.value,
        article: {
          ...observation.value.article,
          publishedAt: new Date("2026-08-19T00:00:00.000Z"),
          contentHash: "second",
          externalReviews: [
            {
              ...observation.value.article.externalReviews[0],
              nativeScore: {
                value: 93.5,
                scale: 100,
                display: "93.5/100",
              },
            },
          ],
        },
      },
    },
  });

  const storedExternalReviews = await db
    .select({ externalReview: externalReviews })
    .from(externalReviews)
    .innerJoin(
      externalReviewArticles,
      eq(externalReviews.articleId, externalReviewArticles.id),
    )
    .where(eq(externalReviewArticles.externalSiteId, site.id));
  expect(
    storedExternalReviews.map(({ externalReview }) => externalReview),
  ).toMatchObject([
    {
      articleId: expect.any(Number),
      bottleId: bottle.id,
      name: bottle.fullName,
      legacyNormalizedScore: null,
      nativeScoreValue: 93.5,
      nativeScoreScale: 100,
      nativeScoreDisplay: "93.5/100",
      sourceKey: url,
      hidden: true,
    },
  ]);
  expect(await db.select().from(externalReviewBodies)).toMatchObject([
    {
      externalReviewId: storedExternalReviews[0]!.externalReview.id,
      body: observation.value.externalReviewBodies[url],
    },
  ]);
  expect(
    await db
      .select()
      .from(externalReviewArticles)
      .where(
        and(
          eq(externalReviewArticles.externalSiteId, site.id),
          eq(externalReviewArticles.canonicalUrl, url),
        ),
      ),
  ).toMatchObject([
    {
      id: storedExternalReviews[0]!.externalReview.articleId,
      issue: "Fall 2026",
      title: bottle.fullName,
      publishedAt: new Date("2026-08-19T00:00:00.000Z"),
      contentHash: expect.any(String),
      fetchedAt: expect.any(Date),
    },
  ]);
});
