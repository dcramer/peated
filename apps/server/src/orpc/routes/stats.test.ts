import { db } from "@peated/server/db";
import {
  bottleTombstones,
  externalReviewArticles,
  memberReviews,
  tastings,
} from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import { eq, sql } from "drizzle-orm";

describe("GET /stats", () => {
  test("returns the current tasting count", async ({ fixtures }) => {
    await fixtures.Tasting();

    const data = await routerClient.stats();
    const [{ count }] = await db
      .select({ count: sql<string>`COUNT(${tastings.id})` })
      .from(tastings);

    expect(data.tastings).toBe(Number(count));
    expect(data.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("returns entity totals by kind", async ({ fixtures }) => {
    await fixtures.Entity({ name: "Stats Brand", kind: "brand" });
    await fixtures.Entity({ name: "Stats Distillery", kind: "distillery" });
    await fixtures.Entity({ name: "Stats Bottler", kind: "bottler" });
    await fixtures.Entity({ name: "Stats Blender", kind: "blender" });
    await fixtures.Entity({ name: "Stats Company", kind: "company" });

    const data = await routerClient.stats();

    expect(data).toMatchObject({
      brands: 1,
      distilleries: 1,
      bottlers: 1,
      blenders: 1,
      companies: 1,
    });
  });

  test("counts each active independently complete Bottle", async ({
    fixtures,
  }) => {
    const activeBottle = await fixtures.Bottle();
    if (activeBottle.groupId === null) {
      throw new Error("Expected grouped Bottle fixture");
    }
    await fixtures.Bottle();
    await fixtures.Bottle();
    const sameGroupBottle = await fixtures.BottleGroupMember({
      groupId: activeBottle.groupId,
      edition: "Related Release",
    });
    const legacyBottle = await fixtures.LegacyBottle();
    const retiredBottle = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: activeBottle.id,
    });

    const data = await routerClient.stats();

    expect(data.bottles).toBe(4);
    expect(legacyBottle.groupId).toBeNull();
  });

  test("counts reviews attached to active Bottles", async ({ fixtures }) => {
    const activeBottle = await fixtures.Bottle();
    const retiredBottle = await fixtures.Bottle();
    const privateMember = await fixtures.User({ private: true });
    await db.insert(memberReviews).values([
      {
        bottleId: activeBottle.id,
        createdById: privateMember.id,
        score: 90,
      },
      {
        bottleId: retiredBottle.id,
        createdById: privateMember.id,
        score: 85,
      },
    ]);

    const automaticSite = await fixtures.ExternalSite({ type: "dramface" });
    await fixtures.ExternalReviewSourcePolicy({
      externalSiteId: automaticSite.id,
      publicationMode: "automatic",
    });
    await fixtures.ExternalReview({
      bottleId: activeBottle.id,
      externalSiteId: automaticSite.id,
      name: "Legacy public review",
    });
    const automaticReview = await fixtures.ExternalReview({
      bottleId: activeBottle.id,
      externalSiteId: automaticSite.id,
      name: "Automatic public review",
    });
    await db
      .update(externalReviewArticles)
      .set({ contentHash: "automatic-public-review" })
      .where(eq(externalReviewArticles.id, automaticReview.articleId));

    await fixtures.ExternalReview({
      bottleId: activeBottle.id,
      externalSiteId: automaticSite.id,
      hidden: true,
      name: "Hidden review",
    });
    await fixtures.ExternalReview({
      bottleId: null,
      externalSiteId: automaticSite.id,
      name: "Unmatched review",
    });
    await fixtures.ExternalReview({
      bottleId: retiredBottle.id,
      externalSiteId: automaticSite.id,
      name: "Retired Bottle review",
    });

    const disabledSite = await fixtures.ExternalSite({ type: "fredminnick" });
    const stagedReview = await fixtures.ExternalReview({
      bottleId: activeBottle.id,
      externalSiteId: disabledSite.id,
      name: "Staged review",
    });
    await db
      .update(externalReviewArticles)
      .set({ contentHash: "staged-review" })
      .where(eq(externalReviewArticles.id, stagedReview.articleId));

    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: activeBottle.id,
    });

    const data = await routerClient.stats();

    expect(data.memberReviews).toBe(1);
    expect(data.externalReviews).toBe(2);
  });
});
