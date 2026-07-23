import { db } from "@peated/server/db";
import {
  bottleReleasePromotions,
  bottleTombstones,
  bottles,
  catalogTargets,
  collectionBottles,
  type Bottle,
  type BottleRelease,
} from "@peated/server/db/schema";
import { RESERVED_COLLECTIONS } from "@peated/server/lib/db";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

async function mapPromotedRelease(release: BottleRelease, bottle: Bottle) {
  await db.transaction(async (tx) => {
    const parent = await tx.query.bottles.findFirst({
      where: eq(bottles.id, release.bottleId),
      columns: { groupId: true },
    });
    if (!parent) throw new Error("Missing legacy parent fixture.");
    if (parent.groupId === null) {
      if (!bottle.groupId)
        throw new Error("Missing promotion BottleGroup fixture.");
      await tx
        .update(bottles)
        .set({ groupId: bottle.groupId })
        .where(eq(bottles.id, release.bottleId));
    }

    await tx.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: bottle.id,
      status: "promoted",
      completedAt: new Date(),
    });
  });
}

async function getExactTargetId(bottleId: number): Promise<number> {
  const [target] = await db
    .select({ id: catalogTargets.id })
    .from(catalogTargets)
    .where(eq(catalogTargets.bottleId, bottleId));
  if (!target) throw new Error("Missing exact CatalogTarget fixture.");
  return target.id;
}

describe("GET /bottle-releases/:release", function () {
  it("projects the promoted Bottle through the legacy response shape", async function ({
    fixtures,
    defaults,
  }) {
    const legacyParent = await fixtures.LegacyBottle({
      name: "Legacy Parent",
    });
    const release = await fixtures.BottleRelease({
      bottleId: legacyParent.id,
      name: "Stale release name",
      abv: 40,
    });
    const promoted = await fixtures.Bottle({
      name: "Promoted Bottle",
      edition: "Exact Edition",
      abv: 57.2,
      totalTastings: 8,
    });
    await mapPromotedRelease(release, promoted);

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

    const result = await routerClient.bottleReleases.details(
      {
        release: release.id,
      },
      { context: { user: defaults.user } },
    );

    expect(result.id).toBe(release.id);
    expect(result).toMatchObject({
      bottleId: legacyParent.id,
      name: promoted.name,
      fullName: promoted.fullName,
      edition: promoted.edition,
      abv: promoted.abv,
      totalTastings: promoted.totalTastings,
      isFavorite: true,
      hasTasted: true,
    });
  });

  it("conflicts when promotion is incomplete", async function ({ fixtures }) {
    const legacyParent = await fixtures.LegacyBottle();
    const release = await fixtures.BottleRelease({
      bottleId: legacyParent.id,
    });
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      status: "pending",
    });

    const err = await waitError(
      routerClient.bottleReleases.details({ release: release.id }),
    );

    expect(err.message).toContain(
      "the release does not have a completed promotion mapping",
    );
  });

  it("conflicts when promotion points outside the legacy parent group", async function ({
    fixtures,
  }) {
    const groupedParent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: groupedParent.id,
    });
    const promoted = await fixtures.Bottle();
    await mapPromotedRelease(release, promoted);

    const err = await waitError(
      routerClient.bottleReleases.details({ release: release.id }),
    );

    expect(err.message).toContain(
      "the promoted Bottle belongs to a different group than the legacy parent",
    );
  });

  it("conflicts when the promoted Bottle is retired", async function ({
    fixtures,
  }) {
    const legacyParent = await fixtures.LegacyBottle();
    const release = await fixtures.BottleRelease({
      bottleId: legacyParent.id,
    });
    const promoted = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await mapPromotedRelease(release, promoted);
    await db.insert(bottleTombstones).values({
      bottleId: promoted.id,
      newBottleId: replacement.id,
    });

    const err = await waitError(
      routerClient.bottleReleases.details({ release: release.id }),
    );

    expect(err.message).toContain("Catalog target is retired");
  });

  it("errors on invalid release", async function () {
    const err = await waitError(
      routerClient.bottleReleases.details({
        release: 1234,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Release not found.]`);
  });
});
