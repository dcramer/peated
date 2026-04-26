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
});
