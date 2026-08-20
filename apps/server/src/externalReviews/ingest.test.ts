import { db } from "@peated/server/db";
import { bottleTombstones, reviews } from "@peated/server/db/schema";
import { ingestReviewArticle } from "@peated/server/externalReviews/ingest";
import { asc, eq } from "drizzle-orm";
import { beforeEach, expect, test, vi } from "vitest";

const resolveBottleMock = vi.hoisted(() => vi.fn());

vi.mock("@peated/server/lib/bottleReferenceResolution", () => ({
  resolveScrapedBottleReferenceTarget: resolveBottleMock,
}));

function resolution(bottleId: number | null) {
  return {
    assignment:
      bottleId === null ? null : { kind: "direct_bottle" as const, bottleId },
    source: bottleId === null ? "unresolved" : "classifier_match",
    error: null,
    confidence: null,
    model: null,
    rationale: null,
    classifierEvidence: null,
    createdBottle: false,
  };
}

beforeEach(() => {
  resolveBottleMock.mockReset();
});

test("rejects a missing source before Bottle resolution", async () => {
  const externalSiteId = 2_147_483_647;

  await expect(
    ingestReviewArticle({
      externalSiteId,
      fetchedAt: new Date("2026-04-13T12:00:00Z"),
      article: {
        canonicalUrl: "https://reviews.example/articles/missing-source",
        title: "Missing source review",
        contentHash: "sha256:missing-source",
        reviews: [{ sourceKey: "review", name: "Review Bottle" }],
      },
    }),
  ).rejects.toThrow(`External site ${externalSiteId} not found.`);
  expect(resolveBottleMock).not.toHaveBeenCalled();
});

test("resolves each review and hides unresolved or invalid assignments", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const bottle = await fixtures.Bottle({ name: "Resolved Review Bottle" });
  const missingBottleId = 2_147_483_647;
  resolveBottleMock
    .mockResolvedValueOnce(resolution(bottle.id))
    .mockResolvedValueOnce(resolution(null))
    .mockResolvedValueOnce(resolution(missingBottleId));

  await ingestReviewArticle({
    externalSiteId: site.id,
    fetchedAt: new Date("2026-04-13T12:00:00Z"),
    article: {
      canonicalUrl: "https://reviews.example/articles/spring-releases",
      title: "Three spring releases reviewed",
      contentHash: "sha256:first",
      reviews: [
        { sourceKey: "resolved", name: bottle.fullName },
        { sourceKey: "unresolved", name: "Unknown Review Bottle" },
        { sourceKey: "invalid", name: "Missing Review Bottle" },
      ],
    },
  });

  expect(resolveBottleMock).toHaveBeenCalledTimes(3);
  expect(
    await db.select().from(reviews).orderBy(asc(reviews.sourceKey)),
  ).toMatchObject([
    {
      sourceKey: "invalid",
      bottleId: null,
      hidden: true,
    },
    {
      sourceKey: "resolved",
      bottleId: bottle.id,
      hidden: true,
    },
    {
      sourceKey: "unresolved",
      bottleId: null,
      hidden: true,
    },
  ]);
});

test("hides an existing review when its resolved Bottle is retired", async ({
  fixtures,
}) => {
  const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
  const bottle = await fixtures.Bottle({ name: "Retired Review Bottle" });
  const replacement = await fixtures.Bottle({
    name: "Replacement Review Bottle",
  });
  resolveBottleMock.mockResolvedValue(resolution(bottle.id));
  const input = {
    externalSiteId: site.id,
    fetchedAt: new Date("2026-04-13T12:00:00Z"),
    article: {
      canonicalUrl: "https://reviews.example/articles/retired-bottle",
      title: "A retired Bottle review",
      contentHash: "sha256:retired",
      reviews: [{ sourceKey: "retired", name: bottle.fullName }],
    },
  };

  await ingestReviewArticle(input);
  await db
    .update(reviews)
    .set({ hidden: false })
    .where(eq(reviews.sourceKey, "retired"));
  await db.insert(bottleTombstones).values({
    bottleId: bottle.id,
    newBottleId: replacement.id,
  });

  await ingestReviewArticle(input);

  expect(
    await db.query.reviews.findFirst({
      where: eq(reviews.sourceKey, "retired"),
    }),
  ).toMatchObject({
    bottleId: bottle.id,
    hidden: true,
  });
});
