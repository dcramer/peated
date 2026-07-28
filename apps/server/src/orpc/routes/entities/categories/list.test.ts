import { db } from "@peated/server/db";
import {
  bottleGroupDistillers,
  bottleGroupTombstones,
  bottleGroups,
  bottleTombstones,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("GET /entities/:entity/categories", () => {
  test("lists Bottle-owned categories across every entity role", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      totalBottles: 99,
      type: ["brand", "bottler", "distiller"],
    });
    const otherEntity = await fixtures.Entity({
      type: ["brand", "bottler", "distiller"],
    });
    await fixtures.Bottle({
      name: "Brand Role Bottle",
      brandId: entity.id,
      distillerIds: [otherEntity.id],
      category: "bourbon",
    });
    await fixtures.Bottle({
      name: "Bottler Role Bottle",
      brandId: otherEntity.id,
      bottlerId: entity.id,
      distillerIds: [otherEntity.id],
      category: "single_malt",
    });
    await fixtures.Bottle({
      name: "Distiller Role Bottle",
      brandId: otherEntity.id,
      distillerIds: [entity.id],
      category: "rye",
    });

    const data = await routerClient.entities.categories.list({
      entity: entity.id,
    });

    expect(data).toEqual({
      results: [
        { category: "bourbon", count: 1 },
        { category: "rye", count: 1 },
        { category: "single_malt", count: 1 },
      ],
      totalCount: 3,
    });
  });

  test("counts a Bottle once when the entity fills multiple roles", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      type: ["brand", "bottler", "distiller"],
    });
    await fixtures.Bottle({
      name: "Overlapping Roles Bottle",
      brandId: entity.id,
      bottlerId: entity.id,
      distillerIds: [entity.id],
      category: "bourbon",
    });

    const data = await routerClient.entities.categories.list({
      entity: entity.id,
    });

    expect(data).toEqual({
      results: [{ category: "bourbon", count: 1 }],
      totalCount: 1,
    });
  });

  test("counts active Bottles directly and ignores legacy ungrouped identity", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      type: ["brand", "bottler", "distiller"],
    });
    const otherEntity = await fixtures.Entity({
      type: ["brand", "bottler", "distiller"],
    });
    const activeBottle = await fixtures.Bottle({
      name: "Active Bottle Identity",
      brandId: entity.id,
      distillerIds: [entity.id],
      category: "bourbon",
    });
    if (activeBottle.groupId === null) {
      throw new Error("Expected grouped Bottle fixture");
    }
    const sameGroupBottle = await fixtures.BottleGroupMember({
      groupId: activeBottle.groupId,
      edition: "Related Release",
    });
    const groupOnlyBottle = await fixtures.Bottle({
      name: "Group Only Identity",
      brandId: otherEntity.id,
      bottlerId: otherEntity.id,
      distillerIds: [otherEntity.id],
      category: "single_malt",
    });
    await fixtures.Bottle({
      name: "Second Active Identity",
      brandId: entity.id,
      distillerIds: [entity.id],
      category: "rye",
    });
    await fixtures.Bottle({
      name: "Third Active Identity",
      brandId: entity.id,
      distillerIds: [entity.id],
      category: "blend",
    });
    const legacyBottle = await fixtures.LegacyBottle({
      name: "Legacy Ungrouped Identity",
      brandId: entity.id,
      distillerIds: [entity.id],
      category: "blend",
    });
    const retiredBottle = await fixtures.Bottle({
      name: "Retired Bottle Identity",
      brandId: entity.id,
      distillerIds: [entity.id],
      category: "single_grain",
    });
    const retiredGroupBottle = await fixtures.Bottle({
      name: "Retired Group Identity",
      brandId: entity.id,
      distillerIds: [entity.id],
      category: "single_pot_still",
    });
    const destinationBottle = await fixtures.Bottle({
      name: "Retirement Destination Identity",
      brandId: otherEntity.id,
      distillerIds: [otherEntity.id],
      category: "spirit",
    });
    if (
      groupOnlyBottle.groupId === null ||
      retiredGroupBottle.groupId === null ||
      destinationBottle.groupId === null
    ) {
      throw new Error("Expected grouped Bottle fixtures");
    }

    await db
      .update(bottleGroups)
      .set({
        brandId: otherEntity.id,
        bottlerId: otherEntity.id,
        category: "rye",
      })
      .where(eq(bottleGroups.id, activeBottle.groupId));
    await db
      .delete(bottleGroupDistillers)
      .where(eq(bottleGroupDistillers.groupId, activeBottle.groupId));
    await db.insert(bottleGroupDistillers).values({
      groupId: activeBottle.groupId,
      distillerId: otherEntity.id,
    });
    await db
      .update(bottleGroups)
      .set({
        brandId: entity.id,
        bottlerId: entity.id,
        category: "blend",
      })
      .where(eq(bottleGroups.id, groupOnlyBottle.groupId));
    await db
      .delete(bottleGroupDistillers)
      .where(eq(bottleGroupDistillers.groupId, groupOnlyBottle.groupId));
    await db.insert(bottleGroupDistillers).values({
      groupId: groupOnlyBottle.groupId,
      distillerId: entity.id,
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

    const data = await routerClient.entities.categories.list({
      entity: entity.id,
    });

    expect(data).toEqual({
      results: [
        { category: "blend", count: 1 },
        { category: "bourbon", count: 2 },
        { category: "rye", count: 1 },
      ],
      totalCount: 4,
    });
    expect(sameGroupBottle.groupId).toBe(activeBottle.groupId);
    expect(legacyBottle.groupId).toBeNull();
  });

  test("orders nullable category buckets and includes them in the total", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ totalBottles: 0 });
    await fixtures.Bottle({
      name: "Unstated Category Bottle",
      brandId: entity.id,
      category: null,
    });
    await fixtures.Bottle({
      name: "Single Malt Category Bottle",
      brandId: entity.id,
      category: "single_malt",
    });
    await fixtures.Bottle({
      name: "Bourbon Category Bottle",
      brandId: entity.id,
      category: "bourbon",
    });

    const data = await routerClient.entities.categories.list({
      entity: entity.id,
    });

    expect(data).toEqual({
      results: [
        { category: "bourbon", count: 1 },
        { category: "single_malt", count: 1 },
        { category: null, count: 1 },
      ],
      totalCount: 3,
    });
  });

  test("returns empty results for an entity with no Bottles", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ totalBottles: 12 });

    const data = await routerClient.entities.categories.list({
      entity: entity.id,
    });

    expect(data).toEqual({ results: [], totalCount: 0 });
  });

  test("throws error for invalid entity", async () => {
    const err = await waitError(() =>
      routerClient.entities.categories.list({
        entity: 999999,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Entity not found.]`);
  });
});
