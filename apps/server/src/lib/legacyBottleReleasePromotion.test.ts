import { db } from "@peated/server/db";
import {
  bottleReleasePromotions,
  bottleReleases,
  bottleTombstones,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import {
  LegacyBottleReleasePromotionError,
  resolveLegacyBottleReleasePromotion,
} from "@peated/server/lib/legacyBottleReleasePromotion";
import { mergeConcreteBottlesInTransaction } from "@peated/server/lib/mergeConcreteBottles";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("resolveLegacyBottleReleasePromotion", () => {
  test("accepts the former parent after a supported exact Bottle merge", async ({
    fixtures,
  }) => {
    const actor = await getUserActor(await fixtures.User({ mod: true }));
    const formerParent = await fixtures.Bottle({
      name: "Former legacy parent",
    });
    const promotedBottle = await fixtures.BottleGroupMember({
      groupId: formerParent.groupId!,
      edition: "Promoted release",
    });
    const destination = await fixtures.Bottle({
      name: "Surviving legacy parent",
    });
    const release = await fixtures.BottleRelease({
      bottleId: formerParent.id,
      edition: "Promoted release",
    });
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promotedBottle.id,
      status: "promoted",
      completedAt: new Date(),
      error: null,
      createdByActorId: actor.id,
    });

    await db.transaction((tx) =>
      mergeConcreteBottlesInTransaction(tx, {
        sourceBottleId: formerParent.id,
        destinationBottleId: destination.id,
        actorId: actor.id,
      }),
    );

    expect(
      await db.query.bottleReleases.findFirst({
        where: eq(bottleReleases.id, release.id),
      }),
    ).toMatchObject({ bottleId: destination.id });
    expect(
      await db.query.bottleTombstones.findFirst({
        where: eq(bottleTombstones.bottleId, formerParent.id),
      }),
    ).toMatchObject({ newBottleId: destination.id });

    const result = await resolveLegacyBottleReleasePromotion({
      releaseId: release.id,
      expectedParentBottleId: formerParent.id,
      context: {
        access: "read",
        caller: "legacyBottleReleasePromotion.test",
        operation: "resolve_after_parent_merge",
      },
    });

    expect(result.bottle.id).toBe(promotedBottle.id);
    expect(result.release).toEqual({
      id: release.id,
      bottleId: destination.id,
    });
  });

  test("rejects an unrelated expected parent", async ({ fixtures }) => {
    const actor = await getUserActor(await fixtures.User({ mod: true }));
    const parent = await fixtures.Bottle({ name: "Actual legacy parent" });
    const unrelatedParent = await fixtures.Bottle({
      name: "Unrelated legacy parent",
    });
    const promotedBottle = await fixtures.BottleGroupMember({
      groupId: parent.groupId!,
      edition: "Promoted release",
    });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      edition: "Promoted release",
    });
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promotedBottle.id,
      status: "promoted",
      completedAt: new Date(),
      error: null,
      createdByActorId: actor.id,
    });

    await expect(
      resolveLegacyBottleReleasePromotion({
        releaseId: release.id,
        expectedParentBottleId: unrelatedParent.id,
        context: {
          access: "read",
          caller: "legacyBottleReleasePromotion.test",
          operation: "reject_unrelated_parent",
        },
      }),
    ).rejects.toEqual(
      new LegacyBottleReleasePromotionError(
        "parent_mismatch",
        "The release does not belong to the supplied parent Bottle.",
      ),
    );
  });
});
