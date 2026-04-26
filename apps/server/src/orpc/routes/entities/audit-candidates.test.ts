import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("GET /entities/audit-candidates", () => {
  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const err = await waitError(
      routerClient.entities.auditCandidates({}, { context: { user } }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("surfaces grouped bottle evidence for a generic source brand", async ({
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
    const user = await fixtures.User({ mod: true });

    const reserveBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Reserve 9-year-old Triple Aged",
      totalTastings: 9,
    });
    await fixtures.BottleAlias({
      bottleId: reserveBottle.id,
      name: "Canadian Club Reserve 9-year-old Triple Aged",
    });

    const premiumBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Premium",
      totalTastings: 5,
    });
    await fixtures.BottleAlias({
      bottleId: premiumBottle.id,
      name: "Canadian Club Premium",
    });

    const result = await routerClient.entities.auditCandidates(
      {
        query: "Canadian Club",
      },
      { context: { user } },
    );

    expect(result.results).toMatchObject([
      {
        entity: {
          id: currentBrand.id,
          name: "Canadian",
        },
        reasons: [
          {
            kind: "brand_repair_group",
          },
        ],
        candidateTargets: [
          {
            entityId: canadianClub.id,
            name: "Canadian Club",
            candidateCount: 2,
            source: ["grouped_brand_repair"],
            supportingBottleIds: [reserveBottle.id, premiumBottle.id],
          },
        ],
        sampleBottles: [
          {
            id: reserveBottle.id,
          },
          {
            id: premiumBottle.id,
          },
        ],
      },
    ]);
  });

  test("surfaces sibling-brand suffix collisions", async ({ fixtures }) => {
    const currentBrand = await fixtures.Entity({
      name: "Wild Turkey Distillery",
      type: ["brand", "distiller"],
      totalBottles: 1,
      totalTastings: 30,
    });
    const targetBrand = await fixtures.Entity({
      name: "Wild Turkey",
      type: ["brand"],
      totalBottles: 12,
      totalTastings: 180,
    });
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Rare Breed",
      totalTastings: 30,
    });

    await db
      .update(bottles)
      .set({
        fullName: "Wild Turkey Rare Breed",
      })
      .where(eq(bottles.id, bottle.id));

    const result = await routerClient.entities.auditCandidates(
      {
        query: "Wild Turkey Distillery",
      },
      { context: { user } },
    );

    expect(result.results).toMatchObject([
      {
        entity: {
          id: currentBrand.id,
          name: "Wild Turkey Distillery",
        },
        reasons: expect.arrayContaining([
          expect.objectContaining({
            kind: "brand_repair_group",
          }),
          expect.objectContaining({
            kind: "name_suffix_conflict",
          }),
        ]),
        candidateTargets: [
          {
            entityId: targetBrand.id,
            name: "Wild Turkey",
            source: expect.arrayContaining([
              "grouped_brand_repair",
              "name_suffix_sibling",
            ]),
          },
        ],
      },
    ]);
  });

  test("surfaces generic category-style brand names", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const genericBrand = await fixtures.Entity({
      name: "Bourbon Whiskey",
      type: ["brand"],
      totalBottles: 2,
    });
    await fixtures.Bottle({
      brandId: genericBrand.id,
      name: "Store Pick",
    });

    const result = await routerClient.entities.auditCandidates(
      {
        query: "Bourbon",
      },
      { context: { user } },
    );

    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: expect.objectContaining({
            id: genericBrand.id,
            name: "Bourbon Whiskey",
          }),
          reasons: expect.arrayContaining([
            expect.objectContaining({
              kind: "generic_name",
            }),
          ]),
        }),
      ]),
    );
  });
});
