import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottleGroupTombstones,
  catalogTargets,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";

describe("GET /bottle-groups/:group", () => {
  test("returns direct group-owned relationship and aggregate data", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Group Details" });
    await db
      .update(bottleGroups)
      .set({ avgRating: 1.25, totalTastings: 7 })
      .where(eq(bottleGroups.id, bottle.groupId as number));

    const result = await routerClient.bottleGroups.details({
      group: bottle.groupId as number,
    });

    expect(result).toMatchObject({
      id: bottle.groupId,
      name: bottle.name,
      representativeBottleId: bottle.id,
      avgRating: 1.25,
      totalTastings: 7,
      totalBottles: 1,
    });
    expect(result).not.toHaveProperty("targetId");
    expect(result).not.toHaveProperty("kind");
  });

  test("returns not found for an unknown group", async () => {
    const error = await waitError(
      routerClient.bottleGroups.details({ group: 999_999 }),
    );

    expect(error.message).toBe("Bottle group not found (groupId=999999).");
  });

  test("returns conflict for a retired group", async ({ fixtures }) => {
    const source = await fixtures.Bottle({ name: "Retired Group" });
    const destination = await fixtures.Bottle({ name: "Active Group" });
    await db.insert(bottleGroupTombstones).values({
      groupId: source.groupId as number,
      newGroupId: destination.groupId as number,
      createdByActorId: source.createdByActorId,
    });

    const error = await waitError(
      routerClient.bottleGroups.details({ group: source.groupId as number }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: `Bottle group is retired (groupId=${source.groupId}).`,
      data: {
        replacement: { kind: "group", groupId: destination.groupId },
      },
    });
  });

  test("does not require a generic target to return an existing group", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Malformed Group" });
    await db
      .delete(catalogTargets)
      .where(
        and(
          eq(catalogTargets.groupId, bottle.groupId as number),
          isNull(catalogTargets.bottleId),
        ),
      );

    await expect(
      routerClient.bottleGroups.details({ group: bottle.groupId as number }),
    ).resolves.toMatchObject({
      id: bottle.groupId,
      representativeBottleId: bottle.id,
    });
  });
});
