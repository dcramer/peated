import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroups,
  bottleReleasePromotions,
  bottleReleases,
  bottles,
  catalogTargets,
  changes,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { and, asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

async function promoteRelease(releaseId: number, promotedBottleId: number) {
  await db.insert(bottleReleasePromotions).values({
    releaseId,
    promotedBottleId,
    status: "promoted",
    completedAt: new Date(),
  });
}

describe("PATCH /bottle-releases/{release}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("retains moderator-only access", async ({ defaults }) => {
    for (const user of [null, defaults.user]) {
      const error = await waitError(
        routerClient.bottleReleases.update(
          { release: 1 },
          { context: { user } },
        ),
      );
      expect(error).toMatchObject({ status: 401 });
    }
  });

  test("updates only the promoted exact Bottle through the canonical route", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const parent = await fixtures.Bottle({
      name: "Mapped Annual",
      statedAge: 12,
      numReleases: 1,
    });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      edition: "Legacy Batch",
      statedAge: 12,
      abv: 55,
    });
    const promoted = await routerClient.bottles.createFromSource(
      {
        bottle: parent.id,
        edition: "Mapped Batch",
        abv: 55,
        singleCask: true,
        caskStrength: true,
        vintageYear: 2008,
        releaseYear: 2020,
        caskType: "bourbon",
        caskSize: "hogshead",
        caskFill: "refill",
        description: "Original promoted description",
        tastingNotes: {
          nose: "Old nose",
          palate: "Old palate",
          finish: "Old finish",
        },
      },
      { context: { user: mod } },
    );
    const sibling = await routerClient.bottles.createFromSource(
      { bottle: parent.id, edition: "Untouched Sibling", abv: 46 },
      { context: { user: mod } },
    );
    await promoteRelease(release.id, promoted.bottle.id);

    const [releaseBefore] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, release.id));
    const [promotionBefore] = await db
      .select()
      .from(bottleReleasePromotions)
      .where(eq(bottleReleasePromotions.releaseId, release.id));
    const [groupBefore] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, parent.groupId!));
    const targetsBefore = await db
      .select()
      .from(catalogTargets)
      .where(eq(catalogTargets.groupId, parent.groupId!))
      .orderBy(asc(catalogTargets.id));
    const [parentBefore] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, parent.id));
    const [siblingBefore] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, sibling.bottle.id));
    vi.clearAllMocks();

    const result = await routerClient.bottleReleases.update(
      {
        release: release.id,
        edition: "Mapped Batch Updated",
        abv: 0,
        singleCask: false,
        caskStrength: false,
        description: null,
        tastingNotes: null,
      },
      { context: { user: mod } },
    );

    expect(result).toMatchObject({
      schemaVersion: 1,
      kind: "bottle",
      targetId: promoted.targetId,
      group: { id: parent.groupId },
      bottle: {
        id: promoted.bottle.id,
        groupId: parent.groupId,
        edition: "Mapped Batch Updated",
        statedAge: 12,
        abv: 0,
        singleCask: false,
        caskStrength: false,
        vintageYear: 2008,
        releaseYear: 2020,
        caskType: "bourbon",
        caskSize: "hogshead",
        caskFill: "refill",
        description: null,
        tastingNotes: null,
      },
    });

    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, promoted.bottle.id));
    expect(updatedBottle).toMatchObject({
      id: promoted.bottle.id,
      edition: "Mapped Batch Updated",
      statedAge: 12,
      abv: 0,
      singleCask: false,
      caskStrength: false,
      vintageYear: 2008,
      releaseYear: 2020,
      caskType: "bourbon",
      caskSize: "hogshead",
      caskFill: "refill",
      description: null,
      tastingNotes: null,
    });
    expect(
      await db
        .select()
        .from(bottleAliases)
        .where(eq(bottleAliases.name, result.bottle.fullName)),
    ).toEqual([
      expect.objectContaining({
        bottleId: promoted.bottle.id,
        releaseId: null,
        targetId: promoted.targetId,
        assignmentSource: "canonical",
      }),
    ]);
    expect(
      await db
        .select()
        .from(changes)
        .where(
          and(
            eq(changes.objectType, "bottle"),
            eq(changes.objectId, promoted.bottle.id),
            eq(changes.type, "update"),
          ),
        ),
    ).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({ updateScope: "exact" }),
      }),
    ]);
    expect(
      await db
        .select()
        .from(changes)
        .where(
          and(
            eq(changes.objectType, "bottle_release"),
            eq(changes.objectId, release.id),
          ),
        ),
    ).toHaveLength(0);

    expect(
      await db
        .select()
        .from(bottleReleases)
        .where(eq(bottleReleases.id, release.id)),
    ).toEqual([releaseBefore]);
    expect(
      await db
        .select()
        .from(bottleReleasePromotions)
        .where(eq(bottleReleasePromotions.releaseId, release.id)),
    ).toEqual([promotionBefore]);
    expect(
      await db
        .select()
        .from(bottleGroups)
        .where(eq(bottleGroups.id, parent.groupId!)),
    ).toEqual([groupBefore]);
    expect(
      await db
        .select()
        .from(catalogTargets)
        .where(eq(catalogTargets.groupId, parent.groupId!))
        .orderBy(asc(catalogTargets.id)),
    ).toEqual(targetsBefore);
    expect(
      await db.select().from(bottles).where(eq(bottles.id, parent.id)),
    ).toEqual([parentBefore]);
    expect(
      await db.select().from(bottles).where(eq(bottles.id, sibling.bottle.id)),
    ).toEqual([siblingBefore]);

    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith("OnBottleChange", {
      bottleId: promoted.bottle.id,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "OnBottleAliasChange",
      { name: result.bottle.fullName },
    );
    expect(workerClient.pushJob).not.toHaveBeenCalledWith(
      "OnBottleReleaseChange",
      expect.anything(),
    );
  });

  test("rejects image URLs, preserves an omitted image, and clears explicit null", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const parent = await fixtures.Bottle({ name: "Image Parent" });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await routerClient.bottles.createFromSource(
      { bottle: parent.id, edition: "Image Mapped" },
      { context: { user: mod } },
    );
    await promoteRelease(release.id, promoted.bottle.id);
    await db
      .update(bottles)
      .set({ imageUrl: "https://example.com/original.jpg" })
      .where(eq(bottles.id, promoted.bottle.id));
    vi.clearAllMocks();

    const unsupported = await waitError(
      routerClient.bottleReleases.update(
        {
          release: release.id,
          imageUrl: "https://example.com/replacement.jpg",
        },
        { context: { user: mod } },
      ),
    );
    expect(unsupported).toMatchObject({ status: 400 });
    expect(
      await db
        .select({ imageUrl: bottles.imageUrl })
        .from(bottles)
        .where(eq(bottles.id, promoted.bottle.id)),
    ).toEqual([{ imageUrl: "https://example.com/original.jpg" }]);

    const omitted = await routerClient.bottleReleases.update(
      { release: release.id, description: "Image remains" },
      { context: { user: mod } },
    );
    expect(omitted.bottle.imageUrl).toBe("https://example.com/original.jpg");

    const cleared = await routerClient.bottleReleases.update(
      { release: release.id, imageUrl: null },
      { context: { user: mod } },
    );
    expect(cleared.bottle.imageUrl).toBeNull();
    expect(
      await db
        .select({ imageUrl: bottles.imageUrl })
        .from(bottles)
        .where(eq(bottles.id, promoted.bottle.id)),
    ).toEqual([{ imageUrl: null }]);
    expect(
      await db
        .select()
        .from(bottleReleases)
        .where(eq(bottleReleases.id, release.id)),
    ).toEqual([release]);
  });

  test("returns not found when the legacy release does not exist", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const error = await waitError(
      routerClient.bottleReleases.update(
        { release: 999_999, edition: "Missing" },
        { context: { user: mod } },
      ),
    );
    expect(error).toMatchObject({ status: 404 });
  });

  test("rejects missing, pending, and corrupt promotion mappings", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });

    const missingParent = await fixtures.Bottle({ name: "Missing Mapping" });
    const missingRelease = await fixtures.BottleRelease({
      bottleId: missingParent.id,
    });

    const pendingParent = await fixtures.Bottle({ name: "Pending Mapping" });
    const pendingRelease = await fixtures.BottleRelease({
      bottleId: pendingParent.id,
    });
    await db.insert(bottleReleasePromotions).values({
      releaseId: pendingRelease.id,
      promotedBottleId: pendingParent.id,
      status: "pending",
    });

    const corruptParent = await fixtures.Bottle({ name: "Corrupt Mapping" });
    const corruptRelease = await fixtures.BottleRelease({
      bottleId: corruptParent.id,
    });
    const wrongGroupBottle = await fixtures.Bottle({ name: "Wrong Group" });
    await promoteRelease(corruptRelease.id, wrongGroupBottle.id);
    const bottlesBefore = await db
      .select()
      .from(bottles)
      .orderBy(asc(bottles.id));
    const changesBefore = await db
      .select()
      .from(changes)
      .orderBy(asc(changes.id));

    for (const releaseId of [
      missingRelease.id,
      pendingRelease.id,
      corruptRelease.id,
    ]) {
      const error = await waitError(
        routerClient.bottleReleases.update(
          { release: releaseId, edition: "Must not apply" },
          { context: { user: mod } },
        ),
      );
      expect(error).toMatchObject({ status: 409 });
    }
    expect(await db.select().from(bottles).orderBy(asc(bottles.id))).toEqual(
      bottlesBefore,
    );
    expect(await db.select().from(changes).orderBy(asc(changes.id))).toEqual(
      changesBefore,
    );
  });

  test("propagates canonical identity conflicts and rolls back the update", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const parent = await fixtures.Bottle({ name: "Collision Parent" });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await routerClient.bottles.createFromSource(
      { bottle: parent.id, edition: "First Identity" },
      { context: { user: mod } },
    );
    const conflicting = await routerClient.bottles.createFromSource(
      { bottle: parent.id, edition: "Second Identity" },
      { context: { user: mod } },
    );
    await promoteRelease(release.id, promoted.bottle.id);

    const bottlesBefore = await db
      .select()
      .from(bottles)
      .orderBy(asc(bottles.id));
    const aliasesBefore = await db
      .select()
      .from(bottleAliases)
      .orderBy(asc(bottleAliases.name));
    const targetsBefore = await db
      .select()
      .from(catalogTargets)
      .orderBy(asc(catalogTargets.id));
    const groupsBefore = await db
      .select()
      .from(bottleGroups)
      .orderBy(asc(bottleGroups.id));
    const changesBefore = await db
      .select()
      .from(changes)
      .orderBy(asc(changes.id));
    const releasesBefore = await db
      .select()
      .from(bottleReleases)
      .orderBy(asc(bottleReleases.id));
    const promotionsBefore = await db
      .select()
      .from(bottleReleasePromotions)
      .orderBy(asc(bottleReleasePromotions.releaseId));
    vi.clearAllMocks();

    const conflict = await waitError(
      routerClient.bottleReleases.update(
        { release: release.id, edition: "Second Identity" },
        { context: { user: mod } },
      ),
    );
    expect(conflict).toMatchObject({
      status: 409,
      data: { bottle: conflicting.bottle.id },
    });

    expect(await db.select().from(bottles).orderBy(asc(bottles.id))).toEqual(
      bottlesBefore,
    );
    expect(
      await db.select().from(bottleAliases).orderBy(asc(bottleAliases.name)),
    ).toEqual(aliasesBefore);
    expect(
      await db.select().from(catalogTargets).orderBy(asc(catalogTargets.id)),
    ).toEqual(targetsBefore);
    expect(
      await db.select().from(bottleGroups).orderBy(asc(bottleGroups.id)),
    ).toEqual(groupsBefore);
    expect(await db.select().from(changes).orderBy(asc(changes.id))).toEqual(
      changesBefore,
    );
    expect(
      await db.select().from(bottleReleases).orderBy(asc(bottleReleases.id)),
    ).toEqual(releasesBefore);
    expect(
      await db
        .select()
        .from(bottleReleasePromotions)
        .orderBy(asc(bottleReleasePromotions.releaseId)),
    ).toEqual(promotionsBefore);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });
});
