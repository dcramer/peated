import { db } from "@peated/server/db";
import {
  bottleReleasePromotions,
  bottleTombstones,
  bottles,
  catalogTargets,
  collectionBottles,
  type Bottle,
  type BottleRelease,
  type User,
} from "@peated/server/db/schema";
import { createConcreteBottle } from "@peated/server/lib/createConcreteBottle";
import { RESERVED_COLLECTIONS } from "@peated/server/lib/db";
import { mergeConcreteBottles } from "@peated/server/lib/mergeConcreteBottles";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq, sql } from "drizzle-orm";

async function mapPromotedRelease(release: BottleRelease, bottle: Bottle) {
  await db.insert(bottleReleasePromotions).values({
    releaseId: release.id,
    promotedBottleId: bottle.id,
    status: "promoted",
    completedAt: new Date(),
  });
}

async function promoteRelease(
  parent: Bottle,
  release: BottleRelease,
  user: User,
  {
    edition,
    releaseYear,
  }: {
    edition: string;
    releaseYear: number;
  },
): Promise<Bottle> {
  const promoted = await createConcreteBottle({
    context: { user },
    input: {
      kind: "source_bottle",
      sourceBottleId: parent.id,
      exact: { edition, releaseYear },
    },
  });
  await mapPromotedRelease(release, promoted.bottle);
  return promoted.bottle;
}

async function getExactTargetId(bottleId: number): Promise<number> {
  const [target] = await db
    .select({ id: catalogTargets.id })
    .from(catalogTargets)
    .where(eq(catalogTargets.bottleId, bottleId));
  if (!target) throw new Error("Missing exact CatalogTarget fixture.");
  return target.id;
}

describe("GET /bottles/:bottle/releases", () => {
  it("lists completed promotions as legacy release projections", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Legacy Family" });
    const release1 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: "Stale release A",
    });
    const release2 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: "Stale release B",
    });
    const release3 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: "Stale release C",
    });
    const promoted1 = await promoteRelease(bottle, release1, defaults.user, {
      edition: "A",
      releaseYear: 2021,
    });
    const promoted2 = await promoteRelease(bottle, release2, defaults.user, {
      edition: "B",
      releaseYear: 2022,
    });
    const promoted3 = await promoteRelease(bottle, release3, defaults.user, {
      edition: "C",
      releaseYear: 2023,
    });

    const { results, rel } = await routerClient.bottleReleases.list({
      bottle: bottle.id,
      limit: 2,
    });

    expect(results.length).toBe(2);
    expect(results[0].id).toBe(release1.id);
    expect(results[0]).toMatchObject({
      bottleId: bottle.id,
      name: promoted1.name,
      fullName: promoted1.fullName,
      edition: promoted1.edition,
      releaseYear: promoted1.releaseYear,
    });
    expect(results[1].id).toBe(release2.id);
    expect(rel.nextCursor).toBe(2);
    expect(rel.prevCursor).toBe(null);
  });

  it("uses exact-target viewer state from the promoted Bottle", async ({
    fixtures,
    defaults,
  }) => {
    const legacyParent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: legacyParent.id,
    });
    const promoted = await promoteRelease(
      legacyParent,
      release,
      defaults.user,
      {
        edition: "Viewer state",
        releaseYear: 2024,
      },
    );

    const targetId = await getExactTargetId(promoted.id);
    const favorites = await fixtures.Collection({
      name: RESERVED_COLLECTIONS.default.name,
      createdById: defaults.user.id,
    });
    await db.insert(collectionBottles).values({
      collectionId: favorites.id,
      bottleId: promoted.id,
      targetId,
    });
    await fixtures.Tasting({
      bottleId: promoted.id,
      targetId,
      createdById: defaults.user.id,
    });

    const { results } = await routerClient.bottleReleases.list(
      { bottle: legacyParent.id },
      { context: { user: defaults.user } },
    );

    expect(results).toEqual([
      expect.objectContaining({
        id: release.id,
        bottleId: legacyParent.id,
        isFavorite: true,
        hasTasted: true,
      }),
    ]);
  });

  it("errors on invalid bottle", async () => {
    const err = await waitError(
      routerClient.bottleReleases.list({
        bottle: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });

  it("filters by bottle", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle();
    const release1 = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "A",
      name: "A",
    });
    const otherParent = await fixtures.Bottle();
    const release2 = await fixtures.BottleRelease({
      bottleId: otherParent.id,
      edition: "B",
      name: "B",
    });
    await promoteRelease(bottle, release1, defaults.user, {
      edition: "Mapped A",
      releaseYear: 2024,
    });
    await promoteRelease(otherParent, release2, defaults.user, {
      edition: "Mapped B",
      releaseYear: 2024,
    });

    const { results, rel } = await routerClient.bottleReleases.list({
      bottle: bottle.id,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(release1.id);
    expect(rel.nextCursor).toBe(null);
    expect(rel.prevCursor).toBe(null);
  });

  it("searches the promoted Bottle index and excludes incomplete mappings", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle({
      name: "Compatibility Parent",
    });
    const mappedRelease = await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: "Legacy wording does not match",
    });
    const pendingRelease = await fixtures.BottleRelease({
      bottleId: bottle.id,
      name: "Searchable only in legacy release",
    });
    const promoted = await promoteRelease(
      bottle,
      mappedRelease,
      defaults.user,
      { edition: "Ordinary Search Identity", releaseYear: 2024 },
    );
    await db
      .update(bottles)
      .set({
        searchVector: sql`to_tsvector('english', ${promoted.fullName})`,
      })
      .where(eq(bottles.id, promoted.id));
    await db.insert(bottleReleasePromotions).values({
      releaseId: pendingRelease.id,
      status: "pending",
    });

    const { results, rel } = await routerClient.bottleReleases.list({
      bottle: bottle.id,
      query: "Compatibility",
    });

    expect(results).toEqual([
      expect.objectContaining({
        id: mappedRelease.id,
        bottleId: bottle.id,
        name: promoted.name,
        fullName: promoted.fullName,
      }),
    ]);
    expect(rel.nextCursor).toBe(null);
    expect(rel.prevCursor).toBe(null);
  });

  it("does not project a completed mapping to a tombstoned Bottle", async ({
    fixtures,
    defaults,
  }) => {
    const parent = await fixtures.Bottle({
      name: "Retired Mapping Parent",
    });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Retired Mapping Release",
    });
    const promoted = await promoteRelease(parent, release, defaults.user, {
      edition: "Retired Promoted Bottle",
      releaseYear: 2024,
    });
    const replacement = await fixtures.Bottle({
      name: "Promoted Bottle Replacement",
    });
    await db.insert(bottleTombstones).values({
      bottleId: promoted.id,
      newBottleId: replacement.id,
    });

    const response = await routerClient.bottleReleases.list({
      bottle: parent.id,
    });

    expect(response.results).toEqual([]);
  });

  it("conflicts on a completed promotion outside the legacy parent group", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({ name: "Grouped Legacy Parent" });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
    });
    const promoted = await fixtures.Bottle({
      name: "Unrelated Promoted Bottle",
    });
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promoted.id,
      status: "promoted",
      completedAt: new Date(),
    });

    const error = await waitError(
      routerClient.bottleReleases.list({ bottle: parent.id }),
    );

    expect(error.message).toContain(
      "the promoted Bottle belongs to a different group than the legacy parent",
    );
  });

  it("accepts a promotion canonically repointed by an exact Bottle merge", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const parent = await fixtures.Bottle({ name: "Merged List Parent" });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const source = await promoteRelease(parent, release, mod, {
      edition: "Merged List Source",
      releaseYear: 2024,
    });
    const destination = await fixtures.Bottle({
      name: "Merged List Destination",
    });

    await mergeConcreteBottles({
      sourceBottleId: source.id,
      destinationBottleId: destination.id,
      context: { user: mod },
    });

    const { results } = await routerClient.bottleReleases.list({
      bottle: parent.id,
    });

    expect(results).toEqual([
      expect.objectContaining({
        id: release.id,
        bottleId: parent.id,
        name: destination.name,
        fullName: destination.fullName,
      }),
    ]);
  });
});
