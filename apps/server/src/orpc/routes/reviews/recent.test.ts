import { db } from "@peated/server/db";
import { reviewArticles } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("GET /reviews/recent", () => {
  test("lists recent matched public reviews", async ({ fixtures }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    await fixtures.EnabledExternalReviewSourcePolicy({
      externalSiteId: site.id,
      publicationMode: "automatic",
    });
    const olderBottle = await fixtures.Bottle();
    const newerBottle = await fixtures.Bottle();
    const older = await fixtures.Review({
      bottleId: olderBottle.id,
      externalSiteId: site.id,
    });
    const newer = await fixtures.Review({
      bottleId: newerBottle.id,
      externalSiteId: site.id,
    });
    const hidden = await fixtures.Review({
      bottleId: newerBottle.id,
      externalSiteId: site.id,
      hidden: true,
    });
    const unmatched = await fixtures.Review({
      bottleId: null,
      externalSiteId: site.id,
    });

    await db
      .update(reviewArticles)
      .set({
        contentHash: "older-content",
        publishedAt: new Date("2026-07-20T00:00:00.000Z"),
      })
      .where(eq(reviewArticles.id, older.articleId!));
    await db
      .update(reviewArticles)
      .set({
        contentHash: "newer-content",
        publishedAt: new Date("2026-07-22T00:00:00.000Z"),
      })
      .where(eq(reviewArticles.id, newer.articleId!));

    const { results } = await routerClient.reviews.recent({ limit: 10 });

    expect(results.map(({ id }) => id)).toEqual([newer.id, older.id]);
    expect(results.map(({ id }) => id)).not.toContain(hidden.id);
    expect(results.map(({ id }) => id)).not.toContain(unmatched.id);
    expect(results[0]).toMatchObject({
      bottle: { id: newerBottle.id },
      site: { id: site.id },
      article: { publishedAt: "2026-07-22T00:00:00.000Z" },
    });
  });

  test("excludes fetched reviews when publication is not automatic", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    await fixtures.EnabledExternalReviewSourcePolicy({
      externalSiteId: site.id,
      publicationMode: "review_only",
    });
    const review = await fixtures.Review({ externalSiteId: site.id });
    await db
      .update(reviewArticles)
      .set({ contentHash: "fetched-content" })
      .where(eq(reviewArticles.id, review.articleId!));

    await expect(routerClient.reviews.recent({})).resolves.toEqual({
      results: [],
    });
  });
});
