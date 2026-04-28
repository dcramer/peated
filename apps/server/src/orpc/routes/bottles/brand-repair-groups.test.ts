import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /bottles/brand-repair-groups", () => {
  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const err = await waitError(
      routerClient.bottles.brandRepairGroups({}, { context: { user } }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("groups a generic source brand into stronger verified target brands", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Canadian",
      type: ["brand"],
    });
    const canadianClub = await fixtures.Entity({
      name: "Canadian Club",
      type: ["brand"],
      totalBottles: 12,
      totalTastings: 180,
    });
    const canadianMist = await fixtures.Entity({
      name: "Canadian Mist",
      type: ["brand"],
      totalBottles: 3,
      totalTastings: 10,
    });
    const user = await fixtures.User({ mod: true });

    const reserveBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Reserve 9-year-old Triple Aged",
      totalTastings: 9,
    });
    await fixtures.BottleAlias({
      bottleId: reserveBottle.id,
      name: "Canadian Club Reserve 9-year-old Triple Aged Group Audit",
    });

    const premiumBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Premium",
      totalTastings: 5,
    });
    await fixtures.BottleAlias({
      bottleId: premiumBottle.id,
      name: "Canadian Club Premium Group Audit",
    });

    const mistBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Mist Black Diamond",
      totalTastings: 3,
    });
    await fixtures.BottleAlias({
      bottleId: mistBottle.id,
      name: "Canadian Mist Black Diamond Group Audit",
    });

    await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "83",
      totalTastings: 1,
    });

    const { results } = await routerClient.bottles.brandRepairGroups(
      {
        query: "Canadian",
      },
      { context: { user } },
    );

    expect(results).toMatchObject([
      {
        candidateCount: 2,
        currentBrand: {
          id: currentBrand.id,
          name: currentBrand.name,
        },
        targetBrand: {
          id: canadianClub.id,
          name: canadianClub.name,
        },
        sampleBottles: [
          {
            bottle: {
              id: reserveBottle.id,
            },
          },
          {
            bottle: {
              id: premiumBottle.id,
            },
          },
        ],
      },
      {
        candidateCount: 1,
        currentBrand: {
          id: currentBrand.id,
          name: currentBrand.name,
        },
        targetBrand: {
          id: canadianMist.id,
          name: canadianMist.name,
        },
        sampleBottles: [
          {
            bottle: {
              id: mistBottle.id,
            },
          },
        ],
      },
    ]);
  });

  test("does not group branded bottles from producer-style aliases", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "A.D. Laws",
      type: ["brand"],
    });
    await fixtures.Entity({
      name: "Laws Whiskey House",
      shortName: "Laws",
      type: ["brand"],
      totalBottles: 12,
    });
    const user = await fixtures.User({ mod: true });

    const straightBourbonBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Four Grain Straight Bourbon",
    });
    await fixtures.BottleAlias({
      bottleId: straightBourbonBottle.id,
      name: "Laws Whiskey House Four Grain Straight Bourbon Whiskey",
    });

    const caskStrengthBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Four Grain Straight Bourbon Cask Strength",
    });
    await fixtures.BottleAlias({
      bottleId: caskStrengthBottle.id,
      name: "Laws Four Grain Straight Bourbon Cask Strength",
    });

    const { results } = await routerClient.bottles.brandRepairGroups(
      {
        query: "Laws",
      },
      { context: { user } },
    );

    expect(results).toEqual([]);
  });

  test("does not group product-suffix brand expansions", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Belle Meade",
      type: ["brand"],
    });
    await fixtures.Entity({
      name: "Belle Meade Bourbon",
      type: ["brand"],
      totalBottles: 1,
      totalTastings: 1,
    });
    const user = await fixtures.User({ mod: true });

    const bottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Sour Mash Straight Whiskey",
      totalTastings: 1,
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Belle Meade Bourbon Sour Mash Straight Whiskey",
    });

    const { results } = await routerClient.bottles.brandRepairGroups(
      {
        query: "Belle Meade",
      },
      { context: { user } },
    );

    expect(results).toEqual([]);
  });

  test("does not reverse a current brand from stale shorter aliases", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Belle Meade Bourbon",
      type: ["brand"],
    });
    await fixtures.Entity({
      name: "Belle Meade",
      type: ["brand"],
    });
    const user = await fixtures.User({ mod: true });

    const bottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Sour Mash Straight Whiskey",
      totalTastings: 1,
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Belle Meade Sour Mash Straight Whiskey",
    });

    const { results } = await routerClient.bottles.brandRepairGroups(
      {
        query: "Belle Meade",
      },
      { context: { user } },
    );

    expect(results).toEqual([]);
  });
});
