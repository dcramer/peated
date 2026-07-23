import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroupTombstones,
  bottleTombstones,
  catalogTargets,
} from "@peated/server/db/schema";
import { backfillLegacyCatalogParent } from "@peated/server/lib/catalogMigrationBackfill";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";
import { describe, expect, test } from "vitest";

function requireGroupId(groupId: number | null): number {
  if (groupId === null) throw new Error("Missing BottleGroup fixture");
  return groupId;
}

describe("GET /bottles/{bottle}/page-target", () => {
  test("returns an active exact Bottle anonymously", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ name: "Public Page Target" });

    const result = await routerClient.bottles.pageTarget({
      bottle: bottle.id,
    });

    expect(result).toEqual({ kind: "bottle", bottleId: bottle.id });
  });

  test("returns the group for a migrated legacy parent with releases", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({ name: "Legacy Family" });
    await fixtures.BottleRelease({
      bottleId: parent.id,
      edition: "First Release",
    });
    const migration = await backfillLegacyCatalogParent(parent.id);

    const result = await routerClient.bottles.pageTarget({
      bottle: parent.id,
    });

    expect(result).toEqual({ kind: "group", groupId: migration.groupId });
    expect(result).not.toHaveProperty("bottleId");
  });

  test("follows a Bottle tombstone to an active exact Bottle", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ name: "Merged Source" });
    const destination = await fixtures.Bottle({ name: "Merged Destination" });
    await db.insert(bottleTombstones).values({
      bottleId: source.id,
      newBottleId: destination.id,
    });

    const result = await routerClient.bottles.pageTarget({
      bottle: source.id,
    });

    expect(result).toEqual({ kind: "bottle", bottleId: destination.id });
  });

  test("follows a Bottle tombstone to an active BottleGroup", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ name: "Grouped Source" });
    const destination = await fixtures.Bottle({ name: "Grouped Destination" });
    const destinationGroupId = requireGroupId(destination.groupId);
    await db.insert(bottleTombstones).values({
      bottleId: source.id,
      newBottleId: null,
      newGroupId: destinationGroupId,
    });

    const result = await routerClient.bottles.pageTarget({
      bottle: source.id,
    });

    expect(result).toEqual({
      kind: "group",
      groupId: destinationGroupId,
    });
  });

  test("follows the group tombstone for a migrated legacy parent", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({ name: "Moved Legacy Family" });
    await fixtures.BottleRelease({
      bottleId: parent.id,
      edition: "First Release",
    });
    const migration = await backfillLegacyCatalogParent(parent.id);
    const destination = await fixtures.Bottle({
      name: "Legacy Family Destination",
    });
    const destinationGroupId = requireGroupId(destination.groupId);
    await db.insert(bottleGroupTombstones).values({
      groupId: migration.groupId,
      newGroupId: destinationGroupId,
      createdByActorId: parent.createdByActorId,
    });

    const result = await routerClient.bottles.pageTarget({
      bottle: parent.id,
    });

    expect(result).toEqual({
      kind: "group",
      groupId: destinationGroupId,
    });
  });

  test("returns not found for an unknown Bottle", async () => {
    const error = await waitError(
      routerClient.bottles.pageTarget({ bottle: 999_999 }),
    );

    expect(error).toMatchObject({ status: 404, message: "Bottle not found." });
  });

  test("returns not found for a retired Bottle without a replacement", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Removed Bottle" });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: null,
      newGroupId: null,
    });

    const error = await waitError(
      routerClient.bottles.pageTarget({ bottle: bottle.id }),
    );

    expect(error).toMatchObject({ status: 404, message: "Bottle not found." });
  });

  test("returns conflict when an active Bottle has lost its exact target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Malformed Active Bottle" });
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
      columns: { id: true },
    });
    if (!target) throw new Error("Missing exact target fixture");
    await db.delete(bottleAliases).where(eq(bottleAliases.targetId, target.id));
    await db.delete(catalogTargets).where(eq(catalogTargets.id, target.id));

    const error = await waitError(
      routerClient.bottles.pageTarget({ bottle: bottle.id }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: expect.stringContaining(
        "the retained Bottle has no exact target",
      ),
    });
  });

  test("returns conflict when an active exact Bottle belongs to a retired group", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Retired Group Member" });
    const destination = await fixtures.Bottle({
      name: "Retired Group Destination",
    });
    const sourceGroupId = requireGroupId(bottle.groupId);
    await db.insert(bottleGroupTombstones).values({
      groupId: sourceGroupId,
      newGroupId: requireGroupId(destination.groupId),
      createdByActorId: bottle.createdByActorId,
    });

    const error = await waitError(
      routerClient.bottles.pageTarget({ bottle: bottle.id }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: expect.stringContaining(`groupId=${sourceGroupId}`),
    });
  });

  test("returns conflict when a group replacement has no generic target", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ name: "Invalid Group Source" });
    const destination = await fixtures.Bottle({
      name: "Invalid Group Destination",
    });
    const destinationGroupId = requireGroupId(destination.groupId);
    const target = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, destinationGroupId),
        isNull(catalogTargets.bottleId),
      ),
      columns: { id: true },
    });
    if (!target) throw new Error("Missing generic target fixture");
    await db.delete(bottleAliases).where(eq(bottleAliases.targetId, target.id));
    await db.delete(catalogTargets).where(eq(catalogTargets.id, target.id));
    await db.insert(bottleTombstones).values({
      bottleId: source.id,
      newBottleId: null,
      newGroupId: destinationGroupId,
    });

    const error = await waitError(
      routerClient.bottles.pageTarget({ bottle: source.id }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: expect.stringContaining(
        "the retired Bottle replacement is invalid",
      ),
    });
  });

  test("does not recursively follow a retired Bottle replacement", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ name: "First Merge Source" });
    const retiredDestination = await fixtures.Bottle({
      name: "Second Merge Source",
    });
    const finalDestination = await fixtures.Bottle({
      name: "Second Merge Destination",
    });
    await db.insert(bottleTombstones).values([
      {
        bottleId: source.id,
        newBottleId: retiredDestination.id,
      },
      {
        bottleId: retiredDestination.id,
        newBottleId: finalDestination.id,
      },
    ]);

    const error = await waitError(
      routerClient.bottles.pageTarget({ bottle: source.id }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: expect.stringContaining(
        "the retired Bottle replacement is invalid",
      ),
    });
  });

  test.each([{ bottle: 0 }, { bottle: -1 }, { bottle: 1.5 }])(
    "rejects an invalid Bottle id: %o",
    async (input) => {
      const error = await waitError(routerClient.bottles.pageTarget(input));
      expect(error).toMatchObject({ status: 400 });
    },
  );
});
