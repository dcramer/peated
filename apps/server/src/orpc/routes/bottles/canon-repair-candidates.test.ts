import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /bottles/canon-repair-candidates", () => {
  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const err = await waitError(
      routerClient.bottles.canonRepairCandidates({}, { context: { user } }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("lists same-brand generic wording variant merge candidates", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Elijah Craig" });
    const user = await fixtures.User({ mod: true });
    const targetBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Barrel Proof",
      category: "bourbon",
      totalTastings: 24,
    });
    const sourceBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Barrel Proof Kentucky Straight Bourbon",
      category: "bourbon",
      totalTastings: 3,
    });
    await fixtures.Bottle({
      brandId: brand.id,
      name: "Toast",
      category: "bourbon",
      totalTastings: 50,
    });

    const { results } = await routerClient.bottles.canonRepairCandidates(
      {},
      { context: { user } },
    );

    expect(results).toMatchObject([
      {
        bottle: {
          id: sourceBottle.id,
          fullName: sourceBottle.fullName,
        },
        targetBottle: {
          id: targetBottle.id,
          fullName: targetBottle.fullName,
        },
      },
    ]);
  });

  test("filters by query against the current bottle name", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Elijah Craig" });
    const user = await fixtures.User({ mod: true });
    await fixtures.Bottle({
      brandId: brand.id,
      name: "Barrel Proof",
      category: "bourbon",
      totalTastings: 24,
    });
    const sourceBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Barrel Proof Kentucky Straight Bourbon",
      category: "bourbon",
      totalTastings: 3,
    });

    const matchingResults = await routerClient.bottles.canonRepairCandidates(
      {
        query: "Kentucky",
      },
      { context: { user } },
    );
    const emptyResults = await routerClient.bottles.canonRepairCandidates(
      {
        query: "Nomatch",
      },
      { context: { user } },
    );

    expect(matchingResults.results.map((result) => result.bottle.id)).toEqual([
      sourceBottle.id,
    ]);
    expect(emptyResults.results).toEqual([]);
  });

  test("search still finds candidates when they fall below the default unfiltered scan cap", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Elijah Craig" });
    const noiseBrand = await fixtures.Entity({ name: "Noise Brand" });
    const user = await fixtures.User({ mod: true });

    await db.insert(bottles).values(
      Array.from({ length: 2000 }, (_, index) => ({
        brandId: noiseBrand.id,
        createdById: user.id,
        fullName: `Noise Brand Noise ${index + 1}`,
        name: `Noise ${index + 1}`,
        totalTastings: 5000 - index,
      })),
    );

    await fixtures.Bottle({
      brandId: brand.id,
      name: "Barrel Proof",
      category: "bourbon",
      totalTastings: 1,
    });
    const sourceBottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Barrel Proof Kentucky Straight Bourbon",
      category: "bourbon",
      totalTastings: 1,
    });

    const matchingResults = await routerClient.bottles.canonRepairCandidates(
      {
        query: "Kentucky",
      },
      { context: { user } },
    );

    expect(matchingResults.results.map((result) => result.bottle.id)).toContain(
      sourceBottle.id,
    );
  });

  test("does not surface release-like bottles as canon repair candidates", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Aberlour" });
    const user = await fixtures.User({ mod: true });
    await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh",
      category: "single_malt",
      totalTastings: 50,
    });
    await fixtures.Bottle({
      brandId: brand.id,
      name: "A'bunadh",
      edition: "Batch 31",
      category: "single_malt",
      totalTastings: 3,
    });

    const { results } = await routerClient.bottles.canonRepairCandidates(
      {},
      { context: { user } },
    );

    expect(results).toEqual([]);
  });

  test("does not surface category-only wording conflicts when one side lacks structured category", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Brand" });
    const user = await fixtures.User({ mod: true });
    await fixtures.Bottle({
      brandId: brand.id,
      name: "Special Bourbon",
      category: null,
      totalTastings: 20,
    });
    await fixtures.Bottle({
      brandId: brand.id,
      name: "Special Rye",
      category: "rye",
      totalTastings: 10,
    });

    const { results } = await routerClient.bottles.canonRepairCandidates(
      {},
      { context: { user } },
    );

    expect(results).toEqual([]);
  });

  test("does not surface repeated-token marketed variants as canon repairs", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Woodford Reserve" });
    const user = await fixtures.User({ mod: true });
    await fixtures.Bottle({
      brandId: brand.id,
      name: "Double Oaked",
      category: "bourbon",
      totalTastings: 30,
    });
    await fixtures.Bottle({
      brandId: brand.id,
      name: "Double Double Oaked",
      category: "bourbon",
      totalTastings: 10,
    });

    const { results } = await routerClient.bottles.canonRepairCandidates(
      {},
      { context: { user } },
    );

    expect(results).toEqual([]);
  });
});
