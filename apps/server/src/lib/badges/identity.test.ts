import { db } from "@peated/server/db";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottleTombstones,
  tastings,
} from "@peated/server/db/schema";
import { CatalogTargetIntegrityMismatchError } from "@peated/server/lib/catalogTargets";
import { eq } from "drizzle-orm";
import { loadBadgeTastings } from "./identity";
import { useGenericBadgeTarget } from "./testHelpers";

describe("loadBadgeTastings", () => {
  test("uses Bottle-owned exact identity and BottleGroup-owned generic identity", async ({
    fixtures,
  }) => {
    const exactBrand = await fixtures.Entity();
    const exactBottler = await fixtures.Entity();
    const exactDistiller = await fixtures.Entity();
    const groupBrand = await fixtures.Entity();
    const groupBottler = await fixtures.Entity();
    const groupDistiller = await fixtures.Entity();
    const bottle = await fixtures.Bottle({
      brandId: exactBrand.id,
      bottlerId: exactBottler.id,
      distillerIds: [exactDistiller.id],
      statedAge: 12,
      category: "single_malt",
    });
    if (!bottle.groupId) throw new Error("Expected a BottleGroup fixture");

    const exactTasting = await fixtures.Tasting({ bottleId: bottle.id });
    const genericTasting = await fixtures.Tasting({
      bottleId: bottle.id,
      createdAt: new Date(exactTasting.createdAt.getTime() + 1),
    });

    await db
      .update(bottleGroups)
      .set({
        brandId: groupBrand.id,
        bottlerId: groupBottler.id,
        statedAge: 18,
        category: "blend",
      })
      .where(eq(bottleGroups.id, bottle.groupId));
    await db
      .delete(bottleGroupDistillers)
      .where(eq(bottleGroupDistillers.groupId, bottle.groupId));
    await db.insert(bottleGroupDistillers).values({
      groupId: bottle.groupId,
      distillerId: groupDistiller.id,
    });

    const [exact] = await loadBadgeTastings(db, [exactTasting], {
      caller: "badges.identity.test",
      operation: "exact",
    });
    const generic = await useGenericBadgeTarget(genericTasting.id);

    expect(exact?.identity).toMatchObject({
      kind: "bottle",
      bottleId: bottle.id,
      statedAge: 12,
      category: "single_malt",
      brand: { id: exactBrand.id },
      bottler: { id: exactBottler.id },
      distillers: [{ id: exactDistiller.id }],
    });
    expect(generic.identity).toMatchObject({
      kind: "group",
      statedAge: 18,
      category: "blend",
      brand: { id: groupBrand.id },
      bottler: { id: groupBottler.id },
      distillers: [{ id: groupDistiller.id }],
    });
    expect(generic).toEqual({
      id: genericTasting.id,
      createdById: genericTasting.createdById,
      identity: generic.identity,
    });
  });

  test("fails closed for a targetless Tasting", async ({ fixtures }) => {
    const tasting = await fixtures.Tasting();
    const [targetless] = await db
      .update(tastings)
      .set({ targetId: null })
      .where(eq(tastings.id, tasting.id))
      .returning();
    if (!targetless) throw new Error("Unable to make Tasting targetless");

    await expect(
      loadBadgeTastings(db, [targetless], {
        caller: "badges.identity.test",
        operation: "targetless",
      }),
    ).rejects.toBeInstanceOf(CatalogTargetIntegrityMismatchError);
  });

  test("fails closed for a retired exact target", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({ bottleId: bottle.id });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: replacement.id,
    });

    await expect(
      loadBadgeTastings(db, [tasting], {
        caller: "badges.identity.test",
        operation: "retired",
      }),
    ).rejects.toMatchObject({ code: "CATALOG_TARGET_RETIRED" });
  });
});
