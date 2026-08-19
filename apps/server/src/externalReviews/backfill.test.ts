import { db } from "@peated/server/db";
import { reviewArticles, reviews } from "@peated/server/db/schema";
import { asc, sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const backfillSql = readFileSync(
  new URL("../../migrations/0222_glossy_eternals.sql", import.meta.url),
  "utf8",
).split("--> statement-breakpoint")[1];
if (!backfillSql) throw new Error("Review article backfill SQL is missing.");

async function runBackfillMigration() {
  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(backfillSql));
  });
}

function withoutArticleId({
  articleId: _articleId,
  ...review
}: typeof reviews.$inferSelect) {
  return review;
}

describe("review article backfill migration", () => {
  test("applies, verifies, and repeats the legacy migration", async ({
    fixtures,
  }) => {
    const firstSite = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const secondSite = await fixtures.ExternalSite({ type: "totalwine" });
    const bottle = await fixtures.Bottle();
    await fixtures.Review({
      articleId: null,
      externalSiteId: firstSite.id,
      bottleId: bottle.id,
      name: "Visible matched review",
      hidden: false,
      issue: "Spring 2024",
      rating: 92,
      url: "https://reviews.example/visible",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-02T00:00:00Z"),
    });
    await fixtures.Review({
      articleId: null,
      externalSiteId: firstSite.id,
      bottleId: null,
      name: "Hidden unresolved review",
      hidden: true,
      issue: "Summer 2024",
      rating: 84,
      url: "https://reviews.example/hidden",
      createdAt: new Date("2024-02-01T00:00:00Z"),
      updatedAt: new Date("2024-02-02T00:00:00Z"),
    });
    await fixtures.Review({
      articleId: null,
      externalSiteId: secondSite.id,
      bottleId: bottle.id,
      name: "Second-site review",
      hidden: false,
      issue: "Autumn 2024",
      rating: 88,
      url: "https://reviews.example/second-site",
      createdAt: new Date("2024-03-01T00:00:00Z"),
      updatedAt: new Date("2024-03-02T00:00:00Z"),
    });
    const originalReviews = await db
      .select()
      .from(reviews)
      .orderBy(asc(reviews.id));

    expect(await db.select().from(reviewArticles)).toHaveLength(0);

    await runBackfillMigration();

    const migratedReviews = await db
      .select()
      .from(reviews)
      .orderBy(asc(reviews.id));
    expect(migratedReviews.map(withoutArticleId)).toEqual(
      originalReviews.map(withoutArticleId),
    );

    const articles = await db
      .select()
      .from(reviewArticles)
      .orderBy(asc(reviewArticles.id));
    expect(articles).toHaveLength(3);
    for (const review of migratedReviews) {
      expect(review.articleId).not.toBeNull();
      expect(articles.find(({ id }) => id === review.articleId)).toMatchObject({
        externalSiteId: review.externalSiteId,
        canonicalUrl: review.url,
        issue: review.issue,
        title: null,
        contentHash: null,
        fetchedAt: null,
      });
    }

    await runBackfillMigration();

    expect(await db.select().from(reviews).orderBy(asc(reviews.id))).toEqual(
      migratedReviews,
    );
    expect(await db.select().from(reviewArticles)).toHaveLength(3);
  });

  test("refuses a mismatched existing article identity", async ({
    fixtures,
  }) => {
    const site = await fixtures.ExternalSite({ type: "whiskyadvocate" });
    const [article] = await db
      .insert(reviewArticles)
      .values({
        externalSiteId: site.id,
        canonicalUrl: "https://reviews.example/articles/canonical",
        issue: "Legacy issue",
      })
      .returning();
    if (!article) throw new Error("Unable to create review article fixture.");
    await fixtures.Review({
      articleId: article.id,
      externalSiteId: site.id,
      issue: "Legacy issue",
      url: "https://reviews.example/articles/different",
    });

    await expect(runBackfillMigration()).rejects.toThrow(
      "Review article backfill left an unlinked or mismatched review",
    );
  });
});
