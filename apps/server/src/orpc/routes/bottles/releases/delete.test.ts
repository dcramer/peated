import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleReleases,
  bottles,
  changes,
  collectionBottles,
  flightBottles,
  tastings,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

describe("DELETE /bottle-releases/:id", () => {
  it("deletes a bottle release and updates related records", async function ({
    fixtures,
  }) {
    const admin = await fixtures.User({ admin: true });

    const release = await fixtures.BottleRelease();

    // Set initial numReleases count
    await db
      .update(bottles)
      .set({ numReleases: 1 })
      .where(eq(bottles.id, release.bottleId));

    // Create related records
    await db.insert(bottleAliases).values({
      releaseId: release.id,
      name: "Test Alias",
      bottleId: release.bottleId,
    });

    await db.insert(collectionBottles).values({
      releaseId: release.id,
      collectionId: (await fixtures.Collection()).id,
      bottleId: release.bottleId,
    });

    await db.insert(flightBottles).values({
      releaseId: release.id,
      flightId: (await fixtures.Flight()).id,
      bottleId: release.bottleId,
    });

    await fixtures.Tasting({
      bottleId: release.bottleId,
      releaseId: release.id,
    });

    // Delete the release
    await routerClient.bottles.releases.delete(release.id, {
      context: { user: admin },
    });

    // Verify the release is deleted
    const [deletedRelease] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, release.id));
    expect(deletedRelease).toBeUndefined();

    // Verify related records are updated
    const [alias] = await db
      .select()
      .from(bottleAliases)
      .where(eq(bottleAliases.bottleId, release.bottleId));
    expect(alias.releaseId).toBeNull();

    const [collectionBottle] = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, release.bottleId));
    expect(collectionBottle.releaseId).toBeNull();

    const [flightBottle] = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.bottleId, release.bottleId));
    expect(flightBottle.releaseId).toBeNull();

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.bottleId, release.bottleId));
    expect(tasting.releaseId).toBeNull();

    // Verify change record is created
    const [change] = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectId, release.id),
          eq(changes.objectType, "bottle_release"),
        ),
      );
    expect(change).toBeDefined();
    expect(change.type).toBe("delete");
    expect(change.displayName).toBe(release.fullName);

    // Verify numReleases was decremented
    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, release.bottleId));
    expect(updatedBottle.numReleases).toBe(0);
  });

  it("throws error if release not found", async function ({ fixtures }) {
    const admin = await fixtures.User({ admin: true });

    const err = await waitError(() =>
      routerClient.bottles.releases.delete(999999, {
        context: { user: admin },
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized]`);
  });
});
