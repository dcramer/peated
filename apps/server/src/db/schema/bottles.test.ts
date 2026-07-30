import { eq } from "drizzle-orm";
import { db } from "../index";
import { bottleAliases, bottleGroups, bottles } from "./bottles";

describe("BottleGroup membership constraints", () => {
  test("accepts a singleton group with its Bottle as representative", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const group = await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, bottle.groupId as number),
    });
    const members = await db.query.bottles.findMany({
      where: eq(bottles.groupId, bottle.groupId as number),
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
      groupId: bottle.groupId as number,
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
      groupId: bottle.groupId as number,
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
