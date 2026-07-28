import { db } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottleTombstones,
  entities,
  tastings,
} from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import { eq, sql } from "drizzle-orm";

describe("GET /stats", () => {
  test("returns raw tasting and entity totals", async ({ fixtures }) => {
    await fixtures.Tasting();
    await fixtures.Entity();

    const data = await routerClient.stats();
    const [{ totalTastings }] = await db
      .select({ totalTastings: sql<string>`COUNT(${tastings.id})` })
      .from(tastings);
    const [{ totalEntities }] = await db
      .select({ totalEntities: sql<string>`COUNT(${entities.id})` })
      .from(entities);

    expect(data.totalTastings).toBe(Number(totalTastings));
    expect(data.totalEntities).toBe(Number(totalEntities));
  });

  test("counts each active independently complete Bottle", async ({
    fixtures,
  }) => {
    const activeBottle = await fixtures.Bottle();
    if (activeBottle.groupId === null) {
      throw new Error("Expected grouped Bottle fixture");
    }
    await fixtures.Bottle();
    await fixtures.Bottle();
    const sameGroupBottle = await fixtures.BottleGroupMember({
      groupId: activeBottle.groupId,
      edition: "Related Release",
    });
    const legacyBottle = await fixtures.LegacyBottle();
    const retiredBottle = await fixtures.Bottle();
    const retiredGroupBottle = await fixtures.Bottle();
    if (retiredGroupBottle.groupId === null) {
      throw new Error("Expected grouped Bottle fixtures");
    }

    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: activeBottle.id,
    });
    await db.insert(bottleGroupTombstones).values({
      groupId: retiredGroupBottle.groupId,
      newGroupId: activeBottle.groupId,
      createdByActorId: retiredGroupBottle.createdByActorId,
    });

    const data = await routerClient.stats();

    expect(data.totalBottles).toBe(4);
    expect(legacyBottle.groupId).toBeNull();
  });
});
