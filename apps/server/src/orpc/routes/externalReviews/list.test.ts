import { db } from "@peated/server/db";
import {
  actors,
  externalReviewArticles,
  externalReviews,
  externalReviewSourcePolicies,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq, sql } from "drizzle-orm";

describe("GET /external-reviews", () => {
  test("lists reviews", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting();
    const review = await fixtures.ExternalReview({ externalSiteId: site.id });
    await fixtures.ExternalReview({ externalSiteId: site.id });

    const { results } = await routerClient.externalReviews.list(
      { sort: "name" },
      { context: { user } },
    );

    expect(results.length).toBe(2);
    const result = results.find(({ id }) => id === review.id)!;
    expect(result.bottle?.id).toBe(review.bottleId);
    expect(result).not.toHaveProperty("target");
    expect(result).not.toHaveProperty("release");
  });

  test("authenticated serialization does not mutate the user's Actor", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSiteOrExisting();
    await fixtures.ExternalReview({ externalSiteId: site.id });
    const currentUser = await fixtures.User({ mod: true });
    const sentinel = {
      active: false,
      displayName: "review read sentinel",
    } as const;
    await db
      .update(actors)
      .set(sentinel)
      .where(eq(actors.userId, currentUser.id));
    const [{ count: before }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(actors);

    await routerClient.externalReviews.list(
      { sort: "name" },
      { context: { user: currentUser } },
    );

    const [{ count: after }] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(actors);
    const actor = await db.query.actors.findFirst({
      where: eq(actors.userId, currentUser.id),
      columns: { active: true, displayName: true },
    });
    expect(after).toBe(before);
    expect(actor).toEqual(sentinel);
  });

  test("errors without mod", async ({ fixtures }) => {
    const user = await fixtures.User();

    const err = await waitError(
      routerClient.externalReviews.list(
        { sort: "name" },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Must be a moderator to list all external reviews.]`,
    );
  });

  test("lists reviews by site", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const astorwine = await fixtures.ExternalSiteOrExisting({
      type: "astorwines",
    });
    const totalwine = await fixtures.ExternalSiteOrExisting({
      type: "totalwine",
    });

    const review = await fixtures.ExternalReview({
      externalSiteId: astorwine.id,
    });
    await fixtures.ExternalReview({ externalSiteId: totalwine.id });

    const { results } = await routerClient.externalReviews.list(
      {
        site: astorwine.type,
        sort: "name",
      },
      { context: { user } },
    );

    expect(results.length).toBe(1);
    expect(results[0].id).toEqual(review.id);
  });

  test("shows staged reviews to moderators but not on public Bottle pages", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const review = await fixtures.ExternalReview({
      bottleId: bottle.id,
      externalSiteId: site.id,
      hidden: true,
    });

    const moderatorResults = await routerClient.externalReviews.list(
      { site: site.type, sort: "name" },
      { context: { user } },
    );
    const publicResults = await routerClient.externalReviews.list({
      bottle: bottle.id,
      sort: "name",
    });

    expect(moderatorResults.results.map(({ id }) => id)).toContain(review.id);
    expect(publicResults.results.map(({ id }) => id)).not.toContain(review.id);
  });

  test("lists recent public reviews by publication date", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({
      imageUrl: "/media/springbank-12.jpg",
      releaseYear: 2026,
      statedAge: 12,
    });
    const site = await fixtures.ExternalSite({
      name: "Whisky Advocate",
      type: "whiskyadvocate",
    });
    await fixtures.EnabledExternalReviewSourcePolicy({
      externalSiteId: site.id,
      publicationMode: "automatic",
    });
    const older = await fixtures.ExternalReview({
      bottleId: bottle.id,
      externalSiteId: site.id,
      url: "https://example.com/older-review",
    });
    const firstAtLatestDate = await fixtures.ExternalReview({
      bottleId: bottle.id,
      externalSiteId: site.id,
      url: "https://example.com/first-latest-review",
    });
    const latest = await fixtures.ExternalReview({
      bottleId: bottle.id,
      externalSiteId: site.id,
      url: "https://example.com/latest-review",
      legacyNormalizedScore: 84,
      reviewerName: "A. Critic",
      nativeScoreValue: 8.4,
      nativeScoreScale: 10,
      nativeScoreDisplay: "8.4/10",
      summary: "A balanced whisky with coastal smoke and a long finish.",
      summaryContentHash: "latest-content",
      summaryModel: "summary-model",
      summaryPromptVersion: "v1",
      summaryGeneratedAt: new Date("2026-08-24T00:00:00.000Z"),
    });
    await Promise.all([
      db
        .update(externalReviewArticles)
        .set({
          contentHash: "older-content",
          publishedAt: new Date("2026-08-22T00:00:00.000Z"),
        })
        .where(eq(externalReviewArticles.id, older.articleId!)),
      db
        .update(externalReviewArticles)
        .set({
          contentHash: "first-latest-content",
          publishedAt: new Date("2026-08-23T00:00:00.000Z"),
        })
        .where(eq(externalReviewArticles.id, firstAtLatestDate.articleId!)),
      db
        .update(externalReviewArticles)
        .set({
          title: "Springbank 12 Year Old Cask Strength review",
          contentHash: "latest-content",
          publishedAt: new Date("2026-08-23T00:00:00.000Z"),
        })
        .where(eq(externalReviewArticles.id, latest.articleId!)),
    ]);

    const hidden = await fixtures.ExternalReview({
      bottleId: bottle.id,
      externalSiteId: site.id,
      hidden: true,
    });
    const unresolved = await fixtures.ExternalReview({
      bottleId: null,
      externalSiteId: site.id,
      name: "Unresolved review",
    });
    const unpublished = await fixtures.ExternalReview({
      bottleId: bottle.id,
      externalSiteId: site.id,
    });
    const reviewOnlySite = await fixtures.ExternalSite({ type: "dramface" });
    await fixtures.EnabledExternalReviewSourcePolicy({
      externalSiteId: reviewOnlySite.id,
    });
    const reviewOnly = await fixtures.ExternalReview({
      bottleId: bottle.id,
      externalSiteId: reviewOnlySite.id,
    });
    await Promise.all(
      [hidden, unresolved, reviewOnly].map((review) =>
        db
          .update(externalReviewArticles)
          .set({
            contentHash: `content-${review.id}`,
            publishedAt: new Date("2026-08-24T00:00:00.000Z"),
          })
          .where(eq(externalReviewArticles.id, review.articleId!)),
      ),
    );
    await db
      .update(externalReviewArticles)
      .set({ contentHash: `content-${unpublished.id}` })
      .where(eq(externalReviewArticles.id, unpublished.articleId!));

    const firstPage = await routerClient.externalReviews.list({
      limit: 2,
    });
    const secondPage = await routerClient.externalReviews.list({
      sort: "recent",
      cursor: 2,
      limit: 2,
    });

    expect(firstPage.results.map(({ id }) => id)).toEqual([
      latest.id,
      firstAtLatestDate.id,
    ]);
    expect(firstPage.results[0]).toMatchObject({
      url: "https://example.com/latest-review",
      site: { id: site.id, name: "Whisky Advocate" },
      reviewerName: "A. Critic",
      article: {
        title: "Springbank 12 Year Old Cask Strength review",
        publishedAt: "2026-08-23T00:00:00.000Z",
      },
      nativeScore: { value: 8.4, scale: 10, display: "8.4/10" },
      summary: "A balanced whisky with coastal smoke and a long finish.",
      bottle: {
        id: bottle.id,
        fullName: bottle.fullName,
        imageUrl: expect.stringContaining("/media/springbank-12.jpg"),
        releaseYear: 2026,
        statedAge: 12,
      },
    });
    expect(firstPage.rel).toEqual({ nextCursor: 2, prevCursor: null });
    expect(secondPage.results.map(({ id }) => id)).toEqual([older.id]);
    expect(secondPage.rel).toEqual({ nextCursor: null, prevCursor: 1 });
  });

  test("uses article-owned source and URL metadata", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const articleSite = await fixtures.ExternalSite({
      type: "whiskyadvocate",
    });
    const otherSite = await fixtures.ExternalSite({ type: "totalwine" });
    const review = await fixtures.ExternalReview({
      externalSiteId: articleSite.id,
      url: "https://example.com/article-owned-review",
    });
    const articleResults = await routerClient.externalReviews.list(
      { site: articleSite.type, sort: "name" },
      { context: { user } },
    );
    const otherResults = await routerClient.externalReviews.list(
      { site: otherSite.type, sort: "name" },
      { context: { user } },
    );
    const allResults = await routerClient.externalReviews.list(
      { sort: "name" },
      { context: { user } },
    );

    expect(articleResults.results).toMatchObject([
      {
        id: review.id,
        url: "https://example.com/article-owned-review",
      },
    ]);
    expect(otherResults.results).toEqual([]);
    expect(allResults.results).toMatchObject([
      {
        id: review.id,
        site: { id: articleSite.id },
      },
    ]);
  });

  test("returns approved article details and native review content", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    await fixtures.EnabledExternalReviewSourcePolicy({
      externalSiteId: site.id,
      publicationMode: "automatic",
    });
    const summaryContentHash = "current-article-content";
    const review = await fixtures.ExternalReview({
      bottleId: bottle.id,
      externalSiteId: site.id,
      legacyNormalizedScore: 78,
      reviewerName: "A. Critic",
      nativeScoreValue: 7.8,
      nativeScoreScale: 10,
      nativeScoreDisplay: "7.8/10",
      summary: "A balanced whisky with coastal smoke and a long finish.",
      summaryContentHash,
      summaryModel: "summary-model",
      summaryPromptVersion: "v1",
      summaryGeneratedAt: new Date("2026-07-23T00:00:00.000Z"),
    });
    await db
      .update(externalReviewArticles)
      .set({
        title: "A review of Springbank 12 Cask Strength",
        publishedAt: new Date("2026-07-22T00:00:00.000Z"),
        contentHash: summaryContentHash,
      })
      .where(eq(externalReviewArticles.id, review.articleId!));

    const { results } = await routerClient.externalReviews.list({
      bottle: bottle.id,
      sort: "name",
    });

    expect(results).toMatchObject([
      {
        id: review.id,
        article: {
          title: "A review of Springbank 12 Cask Strength",
          publishedAt: "2026-07-22T00:00:00.000Z",
        },
        reviewerName: "A. Critic",
        nativeScore: { value: 7.8, scale: 10, display: "7.8/10" },
        summary: "A balanced whisky with coastal smoke and a long finish.",
      },
    ]);
  });

  test("preserves migrated reviews when their source policy is disabled", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    await fixtures.ExternalReviewSourcePolicy({ externalSiteId: site.id });
    const review = await fixtures.ExternalReview({
      bottleId: bottle.id,
      externalSiteId: site.id,
    });

    const { results } = await routerClient.externalReviews.list({
      bottle: bottle.id,
      sort: "name",
    });

    expect(results.map(({ id }) => id)).toContain(review.id);
  });

  test("removes review content and public visibility when policy is revoked", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    await fixtures.EnabledExternalReviewSourcePolicy({
      externalSiteId: site.id,
      publicationMode: "automatic",
    });
    const summaryContentHash = "current-article-content";
    const review = await fixtures.ExternalReview({
      bottleId: bottle.id,
      externalSiteId: site.id,
      nativeScoreValue: 7.8,
      nativeScoreScale: 10,
      nativeScoreDisplay: "7.8/10",
      summary: "A short generated summary.",
      summaryContentHash,
      summaryModel: "summary-model",
      summaryPromptVersion: "v1",
      summaryGeneratedAt: new Date("2026-07-23T00:00:00.000Z"),
    });
    await db
      .update(externalReviewArticles)
      .set({ contentHash: summaryContentHash })
      .where(eq(externalReviewArticles.id, review.articleId!));

    await db
      .update(externalReviewSourcePolicies)
      .set({
        allowLlmProcessing: false,
        allowScoreDisplay: false,
        allowSummaryDisplay: false,
      })
      .where(eq(externalReviewSourcePolicies.externalSiteId, site.id));

    const contentRevoked = await routerClient.externalReviews.list({
      bottle: bottle.id,
      sort: "name",
    });
    expect(contentRevoked.results).toMatchObject([
      { id: review.id, nativeScore: null, summary: null },
    ]);

    await db
      .update(externalReviewSourcePolicies)
      .set({ publicationMode: "disabled" })
      .where(eq(externalReviewSourcePolicies.externalSiteId, site.id));

    await expect(
      routerClient.externalReviews.list({ bottle: bottle.id, sort: "name" }),
    ).resolves.toMatchObject({ results: [] });
  });

  test("lists reviews by direct Bottle identity", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting();
    const firstDirect = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: bottle.id,
      issue: "First direct review",
    });
    const secondDirect = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: bottle.id,
      issue: "Second direct review",
    });
    const otherReview = await fixtures.ExternalReview({
      externalSiteId: site.id,
      bottleId: otherBottle.id,
      issue: "Other Bottle review",
    });

    const { results } = await routerClient.externalReviews.list({
      bottle: bottle.id,
      sort: "name",
    });

    expect(results.map(({ id }) => id)).toEqual(
      expect.arrayContaining([firstDirect.id, secondDirect.id]),
    );
    expect(results.map(({ id }) => id)).not.toContain(otherReview.id);
    expect(
      results.every(
        ({ bottle: resultBottle }) => resultBottle?.id === bottle.id,
      ),
    ).toBe(true);
    expect(results.every((review) => !("target" in review))).toBe(true);
  });

  test("rejects removed target and release filters", async () => {
    // SAFETY: These calls intentionally send removed fields to the runtime validator.
    await expect(
      waitError(() =>
        routerClient.externalReviews.list({ target: 1 } as never),
      ),
    ).resolves.toMatchObject({ message: "Input validation failed" });
    // SAFETY: This call intentionally sends a removed field to the runtime validator.
    await expect(
      waitError(() =>
        routerClient.externalReviews.list({ release: 1 } as never),
      ),
    ).resolves.toMatchObject({ message: "Input validation failed" });
  });

  test("paginates reviews by direct Bottle identity", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting();
    const firstReview = await fixtures.ExternalReview({
      bottleId: bottle.id,
      externalSiteId: site.id,
      name: "A direct Bottle review",
    });
    const secondReview = await fixtures.ExternalReview({
      bottleId: bottle.id,
      externalSiteId: site.id,
      name: "B direct Bottle review",
    });
    const otherReview = await fixtures.ExternalReview({
      bottleId: otherBottle.id,
      externalSiteId: site.id,
      name: "C other Bottle review",
    });

    const firstPage = await routerClient.externalReviews.list({
      bottle: bottle.id,
      sort: "name",
      limit: 1,
    });
    const secondPage = await routerClient.externalReviews.list({
      bottle: bottle.id,
      sort: "name",
      cursor: 2,
      limit: 1,
    });
    const thirdPage = await routerClient.externalReviews.list({
      bottle: bottle.id,
      sort: "name",
      cursor: 3,
      limit: 1,
    });
    const results = [...firstPage.results, ...secondPage.results];

    expect(results.map(({ id }) => id)).toEqual([
      firstReview.id,
      secondReview.id,
    ]);
    expect(results.map(({ id }) => id)).not.toContain(otherReview.id);
    expect(firstPage.rel.nextCursor).toBe(2);
    expect(secondPage.rel.nextCursor).toBeNull();
    expect(thirdPage.results).toEqual([]);
  });

  test("preserves empty Bottle-filter misses", async () => {
    await expect(
      routerClient.externalReviews.list({ bottle: 999_999, sort: "name" }),
    ).resolves.toMatchObject({ results: [] });
  });

  test("uses direct Bottle identity for unresolved filtering", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSiteOrExisting();
    const unresolved = await fixtures.ExternalReview({
      bottleId: null,
      externalSiteId: site.id,
    });
    const retainedBottle = await fixtures.Bottle();
    const firstAssigned = await fixtures.ExternalReview({
      bottleId: retainedBottle.id,
      externalSiteId: site.id,
      issue: "First assigned review",
    });
    const secondAssigned = await fixtures.ExternalReview({
      bottleId: retainedBottle.id,
      externalSiteId: site.id,
      issue: "Second assigned review",
    });

    const unknownResults = await routerClient.externalReviews.list(
      { onlyUnknown: true, sort: "name" },
      { context: { user } },
    );
    const allResults = await routerClient.externalReviews.list(
      { sort: "name" },
      { context: { user } },
    );

    expect(unknownResults.results.map(({ id }) => id)).toContain(unresolved.id);
    expect(unknownResults.results.map(({ id }) => id)).not.toContain(
      firstAssigned.id,
    );
    expect(unknownResults.results.map(({ id }) => id)).not.toContain(
      secondAssigned.id,
    );
    expect(allResults.results.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        unresolved.id,
        firstAssigned.id,
        secondAssigned.id,
      ]),
    );
    expect(unknownResults.results.every(({ bottle }) => bottle === null)).toBe(
      true,
    );
  });

  test("requires a moderator for unknown reviews even with a Bottle filter", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    const err = await waitError(
      routerClient.externalReviews.list({
        bottle: bottle.id,
        onlyUnknown: true,
        sort: "name",
      }),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Must be a moderator to list all external reviews.]`,
    );
  });

  test("errors on site without mod", async ({ fixtures }) => {
    const user = await fixtures.User();
    const site = await fixtures.ExternalSiteOrExisting();

    const err = await waitError(
      routerClient.externalReviews.list(
        {
          site: site.type,
          sort: "name",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Must be a moderator to list all external reviews.]`,
    );
  });
});
