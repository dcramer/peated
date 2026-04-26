import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("POST /bottles/apply-brand-repair-group", () => {
  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const err = await waitError(
      routerClient.bottles.applyBrandRepairGroup(
        {
          fromBrand: 1,
          toBrand: 2,
          distillery: null,
          query: "",
        },
        { context: { user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("applies only the verified bottles for a grouped repair target", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Canadian",
      type: ["brand"],
    });
    const canadianClub = await fixtures.Entity({
      name: "Canadian Club",
      type: ["brand"],
    });
    await fixtures.Entity({
      name: "Canadian Mist",
      type: ["brand"],
    });
    const mod = await fixtures.User({ mod: true });

    const reserveBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Reserve 9-year-old Triple Aged",
      createdById: mod.id,
      totalTastings: 9,
    });
    await fixtures.BottleAlias({
      bottleId: reserveBottle.id,
      name: "Canadian Club Reserve 9-year-old Triple Aged Batch Repair",
    });

    const premiumBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Premium",
      createdById: mod.id,
      totalTastings: 5,
    });
    await fixtures.BottleAlias({
      bottleId: premiumBottle.id,
      name: "Canadian Club Premium Batch Repair",
    });

    const mistBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Mist Black Diamond",
      createdById: mod.id,
      totalTastings: 3,
    });
    await fixtures.BottleAlias({
      bottleId: mistBottle.id,
      name: "Canadian Mist Black Diamond Batch Repair",
    });

    const survivorBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "83",
      createdById: mod.id,
      totalTastings: 1,
    });

    const result = await routerClient.bottles.applyBrandRepairGroup(
      {
        fromBrand: currentBrand.id,
        toBrand: canadianClub.id,
        distillery: null,
        query: "Canadian",
      },
      { context: { user: mod } },
    );

    expect(result).toMatchObject({
      appliedCount: 2,
      bottleIds: expect.arrayContaining([reserveBottle.id, premiumBottle.id]),
      candidateCount: 2,
      failedCount: 0,
      status: "applied",
    });

    const [updatedReserveBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, reserveBottle.id));
    expect(updatedReserveBottle?.brandId).toEqual(canadianClub.id);

    const [updatedPremiumBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, premiumBottle.id));
    expect(updatedPremiumBottle?.brandId).toEqual(canadianClub.id);

    const [updatedMistBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, mistBottle.id));
    expect(updatedMistBottle?.brandId).toEqual(currentBrand.id);

    const [updatedSurvivorBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, survivorBottle.id));
    expect(updatedSurvivorBottle?.brandId).toEqual(currentBrand.id);
  });
});
