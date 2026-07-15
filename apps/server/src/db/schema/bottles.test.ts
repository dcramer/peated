import { eq } from "drizzle-orm";
import { db } from "../index";
import {
  bottleAliases,
  bottleGroups,
  bottles,
  catalogTargets,
} from "./bottles";

describe("BottleGroup and CatalogTarget constraints", () => {
  test("accepts a singleton group with generic and exact targets", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const targets = await db.query.catalogTargets.findMany({
      where: eq(catalogTargets.groupId, bottle.groupId as number),
      orderBy: catalogTargets.bottleId,
    });

    expect(bottle.groupId).not.toBeNull();
    expect(targets).toHaveLength(2);
    expect(targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupId: bottle.groupId,
          bottleId: null,
        }),
        expect.objectContaining({
          groupId: bottle.groupId,
          bottleId: bottle.id,
        }),
      ]),
    );
  });

  test("rejects a second generic target for a group", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();

    await expect(
      db.insert(catalogTargets).values({
        groupId: bottle.groupId as number,
      }),
    ).rejects.toThrow(/catalog_target_generic_group_unq/);
  });

  test("rejects a second exact target for a Bottle", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();

    await expect(
      db.insert(catalogTargets).values({
        groupId: bottle.groupId as number,
        bottleId: bottle.id,
      }),
    ).rejects.toThrow(/catalog_target_bottle_unq/);
  });

  test("rejects an exact target from a different group", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    await db
      .update(bottleAliases)
      .set({ targetId: null })
      .where(eq(bottleAliases.bottleId, bottle.id));
    await db
      .delete(catalogTargets)
      .where(eq(catalogTargets.bottleId, bottle.id));

    await expect(
      db.insert(catalogTargets).values({
        groupId: otherBottle.groupId as number,
        bottleId: bottle.id,
      }),
    ).rejects.toThrow(/catalog_target_bottle_membership_fk/);
  });

  test("rejects a representative Bottle from a different group", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();

    await expect(
      db
        .update(bottleGroups)
        .set({ representativeBottleId: otherBottle.id })
        .where(eq(bottleGroups.id, bottle.groupId as number)),
    ).rejects.toThrow(/bottle_group_representative_membership_fk/);
  });

  test("protects a singleton representative from moving or deletion", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    await db
      .update(bottleGroups)
      .set({ representativeBottleId: bottle.id })
      .where(eq(bottleGroups.id, bottle.groupId as number));
    await db
      .update(bottleAliases)
      .set({ targetId: null })
      .where(eq(bottleAliases.bottleId, bottle.id));
    await db
      .delete(catalogTargets)
      .where(eq(catalogTargets.bottleId, bottle.id));

    await expect(
      db
        .update(bottles)
        .set({ groupId: otherBottle.groupId })
        .where(eq(bottles.id, bottle.id)),
    ).rejects.toThrow(/bottle_group_representative_membership_fk/);
    await db.delete(bottleAliases).where(eq(bottleAliases.bottleId, bottle.id));
    await expect(
      db.delete(bottles).where(eq(bottles.id, bottle.id)),
    ).rejects.toThrow(/bottle_group_representative_membership_fk/);
  });
});
