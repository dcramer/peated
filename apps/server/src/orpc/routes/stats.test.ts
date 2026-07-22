import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroupTombstones,
  bottleTombstones,
  catalogTargets,
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

  test("counts only active exact Bottles", async ({ fixtures }) => {
    const activeBottle = await fixtures.Bottle();
    const genericOnlyBottle = await fixtures.Bottle();
    const legacyBottle = await fixtures.LegacyBottle();
    const retiredBottle = await fixtures.Bottle();
    const retiredGroupBottle = await fixtures.Bottle();
    if (activeBottle.groupId === null || retiredGroupBottle.groupId === null) {
      throw new Error("Expected grouped Bottle fixtures");
    }

    await db
      .delete(bottleAliases)
      .where(eq(bottleAliases.bottleId, genericOnlyBottle.id));
    await db
      .delete(catalogTargets)
      .where(eq(catalogTargets.bottleId, genericOnlyBottle.id));
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

    expect(data.totalBottles).toBe(1);
    expect(legacyBottle.groupId).toBeNull();
  });
});
