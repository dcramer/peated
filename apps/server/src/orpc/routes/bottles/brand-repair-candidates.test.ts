import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /bottles/brand-repair-candidates", () => {
  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const err = await waitError(
      routerClient.bottles.brandRepairCandidates({}, { context: { user } }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("surfaces alias-supported repairs to a stronger target brand", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Canadian",
      type: ["brand"],
    });
    const targetBrand = await fixtures.Entity({
      name: "Canadian Club",
      type: ["brand"],
      totalBottles: 12,
      totalTastings: 180,
    });
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Reserve 9-year-old Triple Aged",
      totalTastings: 9,
    });

    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Canadian Club Reserve 9-year-old Triple Aged",
    });

    const { results } = await routerClient.bottles.brandRepairCandidates(
      {
        query: "Canadian Club",
      },
      { context: { user } },
    );

    expect(results).toMatchObject([
      {
        bottle: {
          id: bottle.id,
          fullName: bottle.fullName,
        },
        currentBrand: {
          id: currentBrand.id,
          name: currentBrand.name,
        },
        targetBrand: {
          id: targetBrand.id,
          name: targetBrand.name,
        },
        suggestedDistillery: null,
        supportingReferences: [
          {
            source: "alias",
            text: "Canadian Club Reserve 9-year-old Triple Aged",
            targetMatchedName: "Canadian Club",
          },
        ],
      },
    ]);
  });

  test("suggests preserving the source brand as a distillery when appropriate", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Isle of Jura",
      type: ["brand", "distiller"],
    });
    const targetBrand = await fixtures.Entity({
      name: "Jura",
      type: ["brand"],
    });
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "12-year-old Single Malt Scotch Whisky",
      totalTastings: 15,
    });

    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Jura 12-year-old Single Malt Scotch Whisky",
    });

    const { results } = await routerClient.bottles.brandRepairCandidates(
      {
        query: "Jura 12-year-old",
      },
      { context: { user } },
    );

    expect(results).toMatchObject([
      {
        bottle: {
          id: bottle.id,
        },
        currentBrand: {
          id: currentBrand.id,
          name: currentBrand.name,
        },
        targetBrand: {
          id: targetBrand.id,
          name: targetBrand.name,
        },
        suggestedDistillery: {
          id: currentBrand.id,
          name: currentBrand.name,
        },
      },
    ]);
  });
});
