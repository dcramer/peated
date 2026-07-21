import { db } from "@peated/server/db";
import { catalogTargets } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { recordStorePriceReadParity } from "./read-parity";

describe("StorePrice route read parity", () => {
  test("returns row-correlated identity and filter mismatches", async ({
    fixtures,
  }) => {
    const targetBottle = await fixtures.Bottle();
    const retainedBottle = await fixtures.Bottle();
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, targetBottle.id),
    });
    if (!target) throw new Error("Missing exact target fixture");
    const price = await fixtures.StorePrice({
      bottleId: retainedBottle.id,
      targetId: target.id,
    });

    const result = await recordStorePriceReadParity(
      [
        {
          id: price.id,
          targetId: price.targetId,
          bottleId: price.bottleId,
          releaseId: price.releaseId,
          targetMatches: true,
          legacyMatches: false,
        },
      ],
      { caller: "read-parity.test", operation: "filter" },
      "catalog_reference",
    );

    expect(result.identityMismatches).toEqual([
      expect.objectContaining({
        consumerTable: "store_price",
        rowLocator: { id: price.id },
        targetId: target.id,
        legacyBottleId: retainedBottle.id,
        targetResolution: expect.objectContaining({
          status: "resolved",
          bottleId: targetBottle.id,
        }),
      }),
    ]);
    expect(result.filterMismatches).toEqual([
      expect.objectContaining({
        consumerTable: "store_price",
        rowLocator: { id: price.id },
        targetMatches: true,
        legacyMatches: false,
      }),
    ]);
  });
});
