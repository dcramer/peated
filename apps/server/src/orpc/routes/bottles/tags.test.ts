import { db } from "@peated/server/db";
import {
  bottleTombstones,
  externalReviewArticles,
  memberReviews,
} from "@peated/server/db/schema";
import { recomputeBottleStats } from "@peated/server/lib/recomputeBottleStats";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("GET /bottles/:bottle/tags", () => {
  test("lists tags", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({
      name: "A",
    });
    const bottle2 = await fixtures.Bottle({
      name: "B",
      brandId: bottle.brandId,
    });
    await Promise.all([
      fixtures.Tag({ name: "solvent" }),
      fixtures.Tag({ name: "caramel" }),
      fixtures.Tag({ name: "cedar" }),
    ]);
    await fixtures.Tasting({
      bottleId: bottle.id,
      tags: ["solvent", "caramel"],
      legacyStarRating: 5,
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      tags: ["caramel"],
      legacyStarRating: 5,
    });
    await recomputeBottleStats(bottle.id);
    await fixtures.Tasting({
      bottleId: bottle2.id,
      tags: ["cedar", "caramel"],
      legacyStarRating: 5,
    });

    const { results, totalCount, publicReviewAndTastingCount } =
      await routerClient.bottles.tags({
        bottle: bottle.id,
      });

    expect(totalCount).toEqual(2);
    expect(publicReviewAndTastingCount).toEqual(2);
    expect(results).toEqual([
      { tag: "caramel", count: 2 },
      { tag: "solvent", count: 1 },
    ]);
  });

  test("counts public records by their direct Bottle reference", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Selected Bottle" });
    const otherBottle = await fixtures.Bottle({ name: "Other Bottle" });
    await Promise.all([
      fixtures.Tag({ name: "wrong-bottle" }),
      fixtures.Tag({ name: "selected-a" }),
      fixtures.Tag({ name: "selected-b" }),
    ]);

    await fixtures.Tasting({
      bottleId: otherBottle.id,
      tags: ["wrong-bottle"],
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      tags: ["selected-a"],
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      tags: ["selected-b"],
    });
    await fixtures.Tasting({
      bottleId: bottle.id,
      tags: [],
    });
    await recomputeBottleStats(bottle.id);

    const result = await routerClient.bottles.tags({ bottle: bottle.id });

    expect(result.totalCount).toBe(3);
    expect(result.publicReviewAndTastingCount).toBe(3);
  });

  test("combines public review and tasting records", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const privateUser = await fixtures.User({ private: true });
    await Promise.all([
      fixtures.Tag({ name: "smoke" }),
      fixtures.Tag({ name: "oak" }),
      fixtures.Tag({ name: "vanilla" }),
    ]);
    await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: defaults.user.id,
      tags: ["smoke", "smoke"],
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
    await fixtures.ExternalReview({
      bottleId: bottle.id,
      tags: ["smoke", "vanilla"],
    });
    const unpublished = await fixtures.ExternalReview({
      bottleId: bottle.id,
      tags: ["oak"],
    });
    await db
      .update(externalReviewArticles)
      .set({ contentHash: "unpublished" })
      .where(eq(externalReviewArticles.id, unpublished.articleId));
    await recomputeBottleStats(bottle.id);

    await expect(
      routerClient.bottles.tags({ bottle: bottle.id }),
    ).resolves.toEqual({
      totalCount: 3,
      publicReviewAndTastingCount: 3,
      results: [
        { tag: "smoke", count: 3 },
        { tag: "oak", count: 1 },
        { tag: "vanilla", count: 1 },
      ],
    });
  });

  test("rejects a retired selected Bottle", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ name: "Selected Bottle" });
    const replacement = await fixtures.Bottle({ name: "Replacement Bottle" });
    await fixtures.Tasting({
      bottleId: bottle.id,
      tags: ["retired"],
    });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: replacement.id,
    });

    const error = await waitError(
      routerClient.bottles.tags({ bottle: bottle.id }),
    );

    expect(error).toMatchObject({ status: 409 });
  });

  test("rejects a Bottle that is not assigned to a group", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.LegacyBottle();

    const error = await waitError(
      routerClient.bottles.tags({ bottle: bottle.id }),
    );

    expect(error).toMatchObject({ status: 409 });
  });

  test("preserves missing Bottle behavior", async () => {
    await expect(
      routerClient.bottles.tags({ bottle: 999_999_999 }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
