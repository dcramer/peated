import { db } from "@peated/server/db";
import { bottles, bottleTombstones } from "@peated/server/db/schema";
import { getBrandRepairCandidates } from "@peated/server/lib/brandRepairCandidates";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
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
      kind: "brand",
    });
    const targetBrand = await fixtures.Entity({
      name: "Canadian Club",
      kind: "brand",
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

  test("uses alias evidence from its direct Bottle", async ({ fixtures }) => {
    const currentBrand = await fixtures.Entity({
      name: "Canadian",
      kind: "brand",
    });
    await fixtures.Entity({
      name: "Canadian Club",
      kind: "brand",
    });
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Direct Alias Reserve",
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Canadian Club Direct Alias Reserve",
    });

    const { results } = await routerClient.bottles.brandRepairCandidates(
      { query: "Direct Alias Reserve" },
      { context: { user } },
    );

    expect(results).toMatchObject([
      {
        bottle: { id: bottle.id },
        currentBrand: { id: currentBrand.id },
        supportingReferences: [
          {
            source: "alias",
            text: "Canadian Club Direct Alias Reserve",
          },
        ],
      },
    ]);
  });

  test("does not move alias evidence away from its direct Bottle", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Canadian",
      kind: "brand",
    });
    const targetBrand = await fixtures.Entity({
      name: "Canadian Club",
      kind: "brand",
    });
    const user = await fixtures.User({ mod: true });
    const retainedBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Direct Membership",
    });
    const unrelatedBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Unrelated Bottle",
    });
    await fixtures.BottleAlias({
      bottleId: retainedBottle.id,
      name: "Canadian Club Direct Membership",
    });

    const { results } = await routerClient.bottles.brandRepairCandidates(
      { query: "Direct Membership" },
      { context: { user } },
    );

    expect(results).toMatchObject([
      {
        bottle: { id: retainedBottle.id },
        currentBrand: { id: currentBrand.id },
        targetBrand: { id: targetBrand.id },
        supportingReferences: [
          {
            source: "alias",
            text: "Canadian Club Direct Membership",
          },
        ],
      },
    ]);
    expect(results.map(({ bottle }) => bottle.id)).not.toContain(
      unrelatedBottle.id,
    );
  });

  test("filters alias evidence for retired Bottles", async ({ fixtures }) => {
    const currentBrand = await fixtures.Entity({
      name: "Canadian",
      kind: "brand",
    });
    await fixtures.Entity({
      name: "Canadian Club",
      kind: "brand",
    });
    const user = await fixtures.User({ mod: true });
    const retiredBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Retired Bottle Evidence",
    });
    const destinationBottle = await fixtures.Bottle({
      name: "Active Destination",
    });
    await fixtures.BottleAlias({
      bottleId: retiredBottle.id,
      name: "Canadian Club Retired Bottle Evidence",
    });
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: destinationBottle.id,
    });

    const { results } = await routerClient.bottles.brandRepairCandidates(
      { query: "Retired" },
      { context: { user } },
    );

    expect(results).toEqual([]);
  });

  test("scans only active exact Bottles with and without a current-brand filter", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Canadian",
      kind: "brand",
    });
    const targetBrand = await fixtures.Entity({
      name: "Canadian Club",
      kind: "brand",
    });
    const user = await fixtures.User({ mod: true });
    const activeBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Active Scan Evidence",
      totalTastings: 10,
    });
    const secondActiveBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Second Active Scan Evidence",
      totalTastings: 5,
    });
    const retiredBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Retired Bottle Scan Evidence",
    });
    const destinationBottle = await fixtures.Bottle({
      name: "Scan Destination",
    });
    await fixtures.BottleAlias({
      bottleId: activeBottle.id,
      name: "Canadian Club Active Scan Evidence",
    });
    await fixtures.BottleAlias({
      bottleId: secondActiveBottle.id,
      name: "Canadian Club Second Active Scan Evidence",
    });
    await fixtures.BottleAlias({
      bottleId: retiredBottle.id,
      name: "Canadian Club Retired Bottle Scan Evidence",
    });
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: destinationBottle.id,
    });

    const [unfiltered, currentBrandFiltered] = await Promise.all([
      routerClient.bottles.brandRepairCandidates({}, { context: { user } }),
      getBrandRepairCandidates({ currentBrandId: currentBrand.id }),
    ]);

    for (const { results } of [unfiltered, currentBrandFiltered]) {
      expect(results).toMatchObject([
        {
          bottle: { id: activeBottle.id },
          currentBrand: { id: currentBrand.id },
          targetBrand: { id: targetBrand.id },
        },
        {
          bottle: { id: secondActiveBottle.id },
          currentBrand: { id: currentBrand.id },
          targetBrand: { id: targetBrand.id },
        },
      ]);
      expect(results).toHaveLength(2);
    }
  });

  test("does not surface ambiguous repairs from an already specific brand", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Acme",
      kind: "brand",
    });
    await fixtures.Entity({
      name: "Acme Heritage",
      kind: "brand",
      totalBottles: 4,
      totalTastings: 20,
    });
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "12-year-old",
      totalTastings: 2,
    });

    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Acme Heritage 12-year-old",
    });

    const { results } = await routerClient.bottles.brandRepairCandidates(
      {
        query: "Acme Heritage",
      },
      { context: { user } },
    );

    expect(results).toEqual([]);
  });

  test("suggests preserving the source brand as a distillery when appropriate", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Isle of Jura",
      kind: "distillery",
    });
    const targetBrand = await fixtures.Entity({
      name: "Jura",
      kind: "brand",
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

  test("does not treat owner-prefixed aliases as stronger than the canonical bottle brand", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Yamazaki",
      kind: "distillery",
    });
    await fixtures.Entity({
      name: "Suntory",
      kind: "brand",
      totalBottles: 50,
      totalTastings: 500,
    });
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "12-year-old",
      totalTastings: 3,
    });

    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Suntory Yamazaki 12-year-old Whisky",
    });

    const { results } = await routerClient.bottles.brandRepairCandidates(
      {
        query: "Yamazaki",
      },
      { context: { user } },
    );

    expect(results).toEqual([]);
  });

  test("surfaces full-name-supported repairs from a distillery-style brand row", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Wild Turkey Distillery",
      kind: "distillery",
    });
    const targetBrand = await fixtures.Entity({
      name: "Wild Turkey",
      kind: "brand",
      totalBottles: 22,
      totalTastings: 140,
    });
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Rare Breed",
      totalTastings: 24,
    });
    await db
      .update(bottles)
      .set({
        fullName: "Wild Turkey Rare Breed",
      })
      .where(eq(bottles.id, bottle.id));

    const { results } = await routerClient.bottles.brandRepairCandidates(
      {
        query: "Wild Turkey",
      },
      { context: { user } },
    );

    expect(results).toMatchObject([
      {
        bottle: {
          id: bottle.id,
          fullName: "Wild Turkey Rare Breed",
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
        supportingReferences: [
          {
            source: "full_name",
            text: "Wild Turkey Rare Breed",
            targetMatchedName: "Wild Turkey",
          },
        ],
      },
    ]);
  });
});
