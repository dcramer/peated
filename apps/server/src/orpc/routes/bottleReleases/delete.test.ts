import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroups,
  bottleReleasePromotions,
  bottleReleases,
  bottles,
  bottleTombstones,
  changes,
  collectionBottles,
  flightBottles,
  reviews,
  tastings,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

async function promoteRelease(releaseId: number, promotedBottleId: number) {
  await db.insert(bottleReleasePromotions).values({
    releaseId,
    promotedBottleId,
  });
}

async function snapshotCatalogGraph() {
  const [
    groups,
    bottleRows,
    releases,
    promotions,
    aliases,
    collectionRows,
    flightRows,
    tastingRows,
    reviewRows,
    changeRows,
    bottleRetirements,
  ] = await Promise.all([
    db.select().from(bottleGroups).orderBy(asc(bottleGroups.id)),
    db.select().from(bottles).orderBy(asc(bottles.id)),
    db.select().from(bottleReleases).orderBy(asc(bottleReleases.id)),
    db
      .select()
      .from(bottleReleasePromotions)
      .orderBy(asc(bottleReleasePromotions.releaseId)),
    db.select().from(bottleAliases).orderBy(asc(bottleAliases.name)),
    db.select().from(collectionBottles).orderBy(asc(collectionBottles.id)),
    db.select().from(flightBottles).orderBy(asc(flightBottles.flightId)),
    db.select().from(tastings).orderBy(asc(tastings.id)),
    db.select().from(reviews).orderBy(asc(reviews.id)),
    db.select().from(changes).orderBy(asc(changes.id)),
    db.select().from(bottleTombstones).orderBy(asc(bottleTombstones.bottleId)),
  ]);

  return {
    groups,
    bottles: bottleRows,
    releases,
    promotions,
    aliases,
    collections: collectionRows,
    flights: flightRows,
    tastings: tastingRows,
    reviews: reviewRows,
    changes: changeRows,
    bottleTombstones: bottleRetirements,
  };
}

describe("DELETE /bottle-releases/{release}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("retains admin-only access", async ({ defaults, fixtures }) => {
    const mod = await fixtures.User({ mod: true });

    for (const user of [null, defaults.user, mod]) {
      const error = await waitError(
        routerClient.bottleReleases.delete(
          { release: 1 },
          { context: { user } },
        ),
      );
      expect(error).toMatchObject({ status: 401 });
    }
  });

  test("returns not found when the retained release does not exist", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const error = await waitError(
      routerClient.bottleReleases.delete(
        { release: 999_999 },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Release not found.]`);
  });

  test("rejects a missing promotion mapping without writes", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });

    const missingParent = await fixtures.Bottle({ name: "Delete Missing" });
    const missingRelease = await fixtures.BottleRelease({
      bottleId: missingParent.id,
    });

    const before = await snapshotCatalogGraph();
    vi.clearAllMocks();

    const error = await waitError(
      routerClient.bottleReleases.delete(
        { release: missingRelease.id },
        { context: { user: admin } },
      ),
    );
    expect(error).toMatchObject({ status: 409 });

    expect(await snapshotCatalogGraph()).toEqual(before);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("requires an explicit merge and leaves the complete mapped graph unchanged", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const parent = await fixtures.Bottle({ name: "Delete Parent" });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await fixtures.BottleGroupMember({
      groupId: parent.groupId as number,
      edition: "Delete Exact",
    });
    await promoteRelease(release.id, promoted.id);

    await db.insert(bottleAliases).values({
      name: "Delete Retained Alias",
      bottleId: promoted.id,
      releaseId: release.id,
      assignedByActorId: release.createdByActorId,
    });
    await db.insert(collectionBottles).values({
      collectionId: (await fixtures.Collection()).id,
      bottleId: promoted.id,
      releaseId: release.id,
    });
    await db.insert(flightBottles).values({
      flightId: (await fixtures.Flight()).id,
      bottleId: promoted.id,
      releaseId: release.id,
    });
    await fixtures.Tasting({
      bottleId: promoted.id,
      releaseId: release.id,
    });
    await fixtures.Review({
      bottleId: promoted.id,
      releaseId: release.id,
      name: release.fullName,
    });

    const before = await snapshotCatalogGraph();
    vi.clearAllMocks();

    const error = await waitError(
      routerClient.bottleReleases.delete(
        { release: release.id },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchObject({
      status: 409,
      message: `BottleRelease ${release.id} maps to Bottle ${promoted.id}; merge that Bottle into an explicit destination instead.`,
    });
    expect(await snapshotCatalogGraph()).toEqual(before);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("requires merging the coherent survivor after an exact Bottle merge", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const parent = await fixtures.Bottle({ name: "Delete Merge Parent" });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await fixtures.BottleGroupMember({
      groupId: parent.groupId as number,
      edition: "Delete Merge Source",
    });
    const survivor = await fixtures.Bottle({ name: "Delete Merge Survivor" });
    await promoteRelease(release.id, promoted.id);

    await routerClient.bottles.merge(
      {
        bottle: promoted.id,
        other: survivor.id,
        direction: "mergeInto",
      },
      { context: { user: admin } },
    );
    const promotion = await db.query.bottleReleasePromotions.findFirst({
      where: eq(bottleReleasePromotions.releaseId, release.id),
    });
    expect(promotion).toMatchObject({ promotedBottleId: survivor.id });
    const before = await snapshotCatalogGraph();
    vi.clearAllMocks();

    const error = await waitError(
      routerClient.bottleReleases.delete(
        { release: release.id },
        { context: { user: admin } },
      ),
    );

    expect(error).toMatchObject({
      status: 409,
      message: `BottleRelease ${release.id} maps to Bottle ${survivor.id}; merge that Bottle into an explicit destination instead.`,
    });
    expect(await snapshotCatalogGraph()).toEqual(before);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });
});
