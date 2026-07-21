import { db } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottleReleasePromotions,
  bottles,
  bottleTombstones,
  catalogTargets,
} from "@peated/server/db/schema";
import { getBrandRepairCandidates } from "@peated/server/lib/brandRepairCandidates";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";
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

  test("does not use a targetless retained Bottle alias as repair evidence", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Canadian",
      type: ["brand"],
    });
    await fixtures.Entity({
      name: "Canadian Club",
      type: ["brand"],
    });
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Targetless Reserve",
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      targetId: null,
      name: "Canadian Club Targetless Reserve",
    });

    const { results } = await routerClient.bottles.brandRepairCandidates(
      { query: "Targetless Reserve" },
      { context: { user } },
    );

    expect(results).toEqual([]);
  });

  test("does not use a generic target alias as exact Bottle repair evidence", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Canadian",
      type: ["brand"],
    });
    await fixtures.Entity({
      name: "Canadian Club",
      type: ["brand"],
    });
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Generic Target Reserve",
    });
    if (bottle.groupId === null) {
      throw new Error("Expected grouped Bottle fixture");
    }
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, bottle.groupId),
        isNull(catalogTargets.bottleId),
      ),
    });
    if (!genericTarget) {
      throw new Error("Expected BottleGroup generic target fixture");
    }
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      targetId: genericTarget.id,
      name: "Canadian Club Generic Target Reserve",
    });

    const { results } = await routerClient.bottles.brandRepairCandidates(
      { query: "Generic Target Reserve" },
      { context: { user } },
    );

    expect(results).toEqual([]);
  });

  test("attributes drifted alias support to the authoritative exact target Bottle", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Canadian",
      type: ["brand"],
    });
    const targetBrand = await fixtures.Entity({
      name: "Canadian Club",
      type: ["brand"],
    });
    const user = await fixtures.User({ mod: true });
    const retainedBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Retained Pair Drift",
    });
    const targetBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Authoritative Target",
    });
    const exactTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, targetBottle.id),
    });
    if (!exactTarget) {
      throw new Error("Expected exact CatalogTarget fixture");
    }
    await fixtures.BottleAlias({
      bottleId: retainedBottle.id,
      targetId: exactTarget.id,
      name: "Canadian Club Retained Pair Drift",
    });

    const { results } = await routerClient.bottles.brandRepairCandidates(
      { query: "Retained Pair Drift" },
      { context: { user } },
    );

    expect(results).toMatchObject([
      {
        bottle: { id: targetBottle.id },
        currentBrand: { id: currentBrand.id },
        targetBrand: { id: targetBrand.id },
        supportingReferences: [
          {
            source: "alias",
            text: "Canadian Club Retained Pair Drift",
          },
        ],
      },
    ]);
    expect(results.map(({ bottle }) => bottle.id)).not.toContain(
      retainedBottle.id,
    );
  });

  test("uses promoted retained alias membership for parity without changing target authority", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Canadian",
      type: ["brand"],
    });
    const targetBrand = await fixtures.Entity({
      name: "Canadian Club",
      type: ["brand"],
    });
    const user = await fixtures.User({ mod: true });
    const parent = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Legacy Promotion Parent",
    });
    if (parent.groupId === null) {
      throw new Error("Expected grouped Bottle fixture");
    }
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const [promoted] = await db
      .insert(bottles)
      .values({
        groupId: parent.groupId,
        brandId: currentBrand.id,
        name: "Promoted Concrete Bottle",
        fullName: "Canadian Promoted Concrete Bottle",
        createdByActorId: parent.createdByActorId,
      })
      .returning();
    if (!promoted) throw new Error("Expected promoted Bottle fixture");
    const [target] = await db
      .insert(catalogTargets)
      .values({ groupId: parent.groupId, bottleId: promoted.id })
      .returning();
    if (!target) throw new Error("Expected promoted target fixture");
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promoted.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: parent.createdByActorId,
    });
    await fixtures.BottleAlias({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: target.id,
      name: "Canadian Club Promoted Pair Evidence",
    });

    const routeResult = await routerClient.bottles.brandRepairCandidates(
      { query: "Promoted Pair Evidence" },
      { context: { user } },
    );
    const filteredResult = await getBrandRepairCandidates({
      currentBrandId: currentBrand.id,
      query: "Promoted Pair Evidence",
    });

    for (const { results } of [routeResult, filteredResult]) {
      expect(results).toMatchObject([
        {
          bottle: { id: promoted.id },
          currentBrand: { id: currentBrand.id },
          targetBrand: { id: targetBrand.id },
          supportingReferences: [
            {
              source: "alias",
              text: "Canadian Club Promoted Pair Evidence",
            },
          ],
        },
      ]);
    }
  });

  test("fails closed when selected alias evidence has a retired durable target", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Canadian",
      type: ["brand"],
    });
    await fixtures.Entity({
      name: "Canadian Club",
      type: ["brand"],
    });
    const user = await fixtures.User({ mod: true });
    const retiredBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Retired Bottle Evidence",
    });
    const retiredGroupBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Retired Group Evidence",
    });
    const destinationBottle = await fixtures.Bottle({
      name: "Active Destination",
    });
    if (
      retiredGroupBottle.groupId === null ||
      destinationBottle.groupId === null
    ) {
      throw new Error("Expected grouped Bottle fixtures");
    }
    await fixtures.BottleAlias({
      bottleId: retiredBottle.id,
      name: "Canadian Club Retired Bottle Evidence",
    });
    await fixtures.BottleAlias({
      bottleId: retiredGroupBottle.id,
      name: "Canadian Club Retired Group Evidence",
    });
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: destinationBottle.id,
    });
    await db.insert(bottleGroupTombstones).values({
      groupId: retiredGroupBottle.groupId,
      newGroupId: destinationBottle.groupId,
      createdByActorId: retiredGroupBottle.createdByActorId,
    });

    const err = await waitError(
      routerClient.bottles.brandRepairCandidates(
        { query: "Retired" },
        { context: { user } },
      ),
    );

    expect(err).toMatchObject({
      status: 409,
      message: `Catalog target is retired (bottleId=${retiredBottle.id}).`,
    });
  });

  test("scans only active exact Bottles with and without a current-brand filter", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Canadian",
      type: ["brand"],
    });
    const targetBrand = await fixtures.Entity({
      name: "Canadian Club",
      type: ["brand"],
    });
    const user = await fixtures.User({ mod: true });
    const activeBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Active Scan Evidence",
    });
    const targetlessAliasBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Targetless Scan Evidence",
    });
    const retiredBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Retired Bottle Scan Evidence",
    });
    const retiredGroupBottle = await fixtures.Bottle({
      brandId: currentBrand.id,
      name: "Retired Group Scan Evidence",
    });
    const destinationBottle = await fixtures.Bottle({
      name: "Scan Destination",
    });
    if (
      retiredGroupBottle.groupId === null ||
      destinationBottle.groupId === null
    ) {
      throw new Error("Expected grouped Bottle fixtures");
    }
    await fixtures.BottleAlias({
      bottleId: activeBottle.id,
      name: "Canadian Club Active Scan Evidence",
    });
    await fixtures.BottleAlias({
      bottleId: targetlessAliasBottle.id,
      targetId: null,
      name: "Canadian Club Targetless Scan Evidence",
    });
    await fixtures.BottleAlias({
      bottleId: retiredBottle.id,
      name: "Canadian Club Retired Bottle Scan Evidence",
    });
    await fixtures.BottleAlias({
      bottleId: retiredGroupBottle.id,
      name: "Canadian Club Retired Group Scan Evidence",
    });
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: destinationBottle.id,
    });
    await db.insert(bottleGroupTombstones).values({
      groupId: retiredGroupBottle.groupId,
      newGroupId: destinationBottle.groupId,
      createdByActorId: retiredGroupBottle.createdByActorId,
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
      ]);
      expect(results).toHaveLength(1);
    }
  });

  test("does not surface ambiguous repairs from an already specific brand", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Acme",
      type: ["brand"],
    });
    await fixtures.Entity({
      name: "Acme Heritage",
      type: ["brand"],
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

  test("does not treat owner-prefixed aliases as stronger than the canonical bottle brand", async ({
    fixtures,
  }) => {
    const currentBrand = await fixtures.Entity({
      name: "Yamazaki",
      type: ["brand", "distiller"],
    });
    await fixtures.Entity({
      name: "Suntory",
      type: ["brand"],
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
      type: ["brand", "distiller"],
    });
    const targetBrand = await fixtures.Entity({
      name: "Wild Turkey",
      type: ["brand"],
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
