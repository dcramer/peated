import { TAG_CATEGORIES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottleTombstones,
  externalReviewArticles,
  memberReviews,
  tastings,
} from "@peated/server/db/schema";
import { recomputeBottleStats } from "@peated/server/lib/recomputeBottleStats";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("GET /bottles/{bottle}/flavor-profile", () => {
  test("counts public tastings once per category and keeps exact Bottle scope", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const sibling = await fixtures.BottleGroupMember({
      groupId: bottle.groupId,
      edition: "Another release",
    });
    const privateUser = await fixtures.User({ private: true });
    for (const [name, tagCategory] of [
      ["smoke", "smoke"],
      ["ash", "smoke"],
      ["bonfire", "smoke"],
      ["vanilla", "sweet"],
      ["iodine", "smoke"],
      ["oak", "wood"],
    ] as const) {
      await fixtures.Tag({ name, tagCategory });
    }
    await db.insert(tastings).values([
      {
        bottleId: bottle.id,
        createdById: defaults.user.id,
        tags: ["smoke", "smoke", "ash", "bonfire", "vanilla"],
        createdAt: new Date("2026-01-01"),
      },
      {
        bottleId: bottle.id,
        createdById: defaults.user.id,
        tags: ["smoke"],
        createdAt: new Date("2026-01-02"),
      },
      {
        bottleId: bottle.id,
        createdById: defaults.user.id,
        tags: ["vanilla"],
        createdAt: new Date("2026-01-03"),
      },
      {
        bottleId: bottle.id,
        createdById: defaults.user.id,
        tags: [],
        createdAt: new Date("2026-01-04"),
      },
      {
        bottleId: bottle.id,
        createdById: defaults.user.id,
        tags: ["unrecognized"],
        createdAt: new Date("2026-01-05"),
      },
      {
        bottleId: bottle.id,
        createdById: privateUser.id,
        tags: ["iodine", "oak"],
      },
      { bottleId: sibling.id, createdById: defaults.user.id, tags: ["oak"] },
    ]);
    await recomputeBottleStats(bottle.id);

    const result = await routerClient.bottles.flavorProfile(
      { bottle: bottle.id },
      { context: { user: privateUser } },
    );
    expect(result).toEqual(
      await routerClient.bottles.flavorProfile({ bottle: bottle.id }),
    );
    expect(result.notedTastings).toBe(3);
    expect(result.categories.map((item) => item.category)).toEqual(
      TAG_CATEGORIES,
    );
    expect(result.categories.find((item) => item.category === "smoke")).toEqual(
      {
        category: "smoke",
        reviewAndTastingCount: 2,
        tastingCount: 2,
        notes: [
          { name: "smoke", reviewAndTastingCount: 2, tastingCount: 2 },
          { name: "ash", reviewAndTastingCount: 1, tastingCount: 1 },
        ],
      },
    );
    expect(result.categories.find((item) => item.category === "sweet")).toEqual(
      {
        category: "sweet",
        reviewAndTastingCount: 2,
        tastingCount: 2,
        notes: [{ name: "vanilla", reviewAndTastingCount: 2, tastingCount: 2 }],
      },
    );
    expect(result.categories.find((item) => item.category === "wood")).toEqual({
      category: "wood",
      reviewAndTastingCount: 0,
      tastingCount: 0,
      notes: [],
    });
  });

  test("returns no distribution for private-only or unrecognized notes", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const privateUser = await fixtures.User({ private: true });
    await fixtures.Tag({ name: "smoke", tagCategory: "smoke" });
    await db.insert(tastings).values([
      { bottleId: bottle.id, createdById: privateUser.id, tags: ["smoke"] },
      {
        bottleId: bottle.id,
        createdById: defaults.user.id,
        tags: ["unrecognized"],
      },
    ]);
    await recomputeBottleStats(bottle.id);
    const result = await routerClient.bottles.flavorProfile({
      bottle: bottle.id,
    });
    expect(result.notedTastings).toBe(0);
    expect(
      result.categories.every(
        (item) => item.tastingCount === 0 && item.notes.length === 0,
      ),
    ).toBe(true);
  });

  test("combines public tasting, member review, and critic review notes", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const privateUser = await fixtures.User({ private: true });
    await Promise.all([
      fixtures.Tag({ name: "smoke", tagCategory: "smoke" }),
      fixtures.Tag({ name: "vanilla", tagCategory: "sweet" }),
      fixtures.Tag({ name: "oak", tagCategory: "wood" }),
    ]);
    await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: defaults.user.id,
      tags: ["smoke"],
    });
    await db.insert(memberReviews).values([
      {
        bottleId: bottle.id,
        createdById: defaults.user.id,
        score: 88,
        tags: ["smoke", "oak"],
      },
      {
        bottleId: bottle.id,
        createdById: privateUser.id,
        score: 90,
        tags: ["vanilla"],
      },
    ]);
    const publishedSite = await fixtures.ExternalSite({
      type: `published-flavor-${bottle.id}`,
    });
    await fixtures.ApprovedExternalReviewPublication({
      externalSiteId: publishedSite.id,
    });
    const published = await fixtures.ExternalReview({
      bottleId: bottle.id,
      externalSiteId: publishedSite.id,
      tags: ["smoke", "vanilla"],
    });
    await db
      .update(externalReviewArticles)
      .set({ contentHash: "published" })
      .where(eq(externalReviewArticles.id, published.articleId));
    await fixtures.ExternalReview({
      bottleId: bottle.id,
      hidden: true,
      tags: ["oak"],
    });
    const unpublishedSite = await fixtures.ExternalSite({
      type: `unpublished-flavor-${bottle.id}`,
    });
    const unpublished = await fixtures.ExternalReview({
      bottleId: bottle.id,
      externalSiteId: unpublishedSite.id,
      tags: ["oak"],
    });
    await db
      .update(externalReviewArticles)
      .set({ contentHash: "unpublished" })
      .where(eq(externalReviewArticles.id, unpublished.articleId));
    await recomputeBottleStats(bottle.id);

    const result = await routerClient.bottles.flavorProfile({
      bottle: bottle.id,
    });

    expect(result.notedReviewAndTastingCount).toBe(3);
    expect(result.notedTastings).toBe(3);
    expect(result.categories.find((item) => item.category === "smoke")).toEqual(
      {
        category: "smoke",
        reviewAndTastingCount: 3,
        tastingCount: 3,
        notes: [{ name: "smoke", reviewAndTastingCount: 3, tastingCount: 3 }],
      },
    );
    expect(result.categories.find((item) => item.category === "sweet")).toEqual(
      {
        category: "sweet",
        reviewAndTastingCount: 1,
        tastingCount: 1,
        notes: [{ name: "vanilla", reviewAndTastingCount: 1, tastingCount: 1 }],
      },
    );
    expect(result.categories.find((item) => item.category === "wood")).toEqual({
      category: "wood",
      reviewAndTastingCount: 1,
      tastingCount: 1,
      notes: [{ name: "oak", reviewAndTastingCount: 1, tastingCount: 1 }],
    });
  });

  test("returns an empty profile without tastings", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const result = await routerClient.bottles.flavorProfile({
      bottle: bottle.id,
    });
    expect(result.notedTastings).toBe(0);
    expect(
      result.categories.every(
        (item) => item.tastingCount === 0 && item.notes.length === 0,
      ),
    ).toBe(true);
  });

  test("rejects missing, retired, and unassigned Bottles", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const legacy = await fixtures.LegacyBottle();
    await db
      .insert(bottleTombstones)
      .values({ bottleId: bottle.id, newBottleId: replacement.id });
    await expect(
      routerClient.bottles.flavorProfile({ bottle: 999_999_999 }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      routerClient.bottles.flavorProfile({ bottle: bottle.id }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      routerClient.bottles.flavorProfile({ bottle: legacy.id }),
    ).rejects.toMatchObject({ status: 409 });
  });

  test("requires a positive integer Bottle ID", async () => {
    await expect(
      routerClient.bottles.flavorProfile({ bottle: -1 }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
