import { eq } from "drizzle-orm";
import { db } from "../index";
import {
  bottleAliases,
  bottleBarcodes,
  bottleGroups,
  bottles,
} from "./bottles";

function requireGroupId(groupId: number | null): number {
  if (groupId === null) throw new Error("Missing BottleGroup fixture");
  return groupId;
}

describe("BottleGroup membership constraints", () => {
  test("accepts a singleton group with its Bottle as representative", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const group = await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, requireGroupId(bottle.groupId)),
    });
    const members = await db.query.bottles.findMany({
      where: eq(bottles.groupId, requireGroupId(bottle.groupId)),
    });

    expect(bottle.groupId).not.toBeNull();
    expect(group?.representativeBottleId).toBe(bottle.id);
    expect(members.map(({ id }) => id)).toEqual([bottle.id]);
  });

  test("allows a non-representative Bottle to move between groups", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const member = await fixtures.BottleGroupMember({
      groupId: requireGroupId(bottle.groupId),
      edition: "Movable Member",
    });
    const destinationBottle = await fixtures.Bottle();

    await db
      .update(bottles)
      .set({ groupId: destinationBottle.groupId })
      .where(eq(bottles.id, member.id));

    const moved = await db.query.bottles.findFirst({
      where: eq(bottles.id, member.id),
    });
    expect(moved?.groupId).toBe(destinationBottle.groupId);
  });

  test("rejects a missing BottleGroup membership", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const member = await fixtures.BottleGroupMember({
      groupId: requireGroupId(bottle.groupId),
      edition: "Missing Group Member",
    });

    await expect(
      db
        .update(bottles)
        .set({ groupId: 9_000_000_000 })
        .where(eq(bottles.id, member.id)),
    ).rejects.toThrow(/bottle_group_id_bottle_group_id_fk/);
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
        .where(eq(bottleGroups.id, requireGroupId(bottle.groupId))),
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
      .where(eq(bottleGroups.id, requireGroupId(bottle.groupId)));

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

describe("Bottle fact constraints", () => {
  test("rejects invalid ABV and years", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();

    await expect(
      db.update(bottles).set({ abv: 101 }).where(eq(bottles.id, bottle.id)),
    ).rejects.toThrow(/bottle_abv_check/);
    await expect(
      db
        .update(bottles)
        .set({ vintageYear: 1799 })
        .where(eq(bottles.id, bottle.id)),
    ).rejects.toThrow(/bottle_vintage_year_check/);
    await expect(
      db
        .update(bottles)
        .set({ bottlingYear: 1799 })
        .where(eq(bottles.id, bottle.id)),
    ).rejects.toThrow(/bottle_bottling_year_check/);
    await expect(
      db
        .update(bottles)
        .set({ releaseYear: 1799 })
        .where(eq(bottles.id, bottle.id)),
    ).rejects.toThrow(/bottle_release_year_check/);
    await expect(
      db
        .update(bottles)
        .set({ releaseYear: 2025, releaseDate: "2024-01-01" })
        .where(eq(bottles.id, bottle.id)),
    ).rejects.toThrow(/bottle_release_date_year_check/);
  });

  test("rejects a non-positive barcode volume", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();

    await expect(
      db.insert(bottleBarcodes).values({
        bottleId: bottle.id,
        value: "036602301979",
        gtin14: "00036602301979",
        volume: 0,
        createdByActorId: bottle.createdByActorId,
      }),
    ).rejects.toThrow(/bottle_barcode_volume_check/);
  });
});
