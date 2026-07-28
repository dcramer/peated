import { db } from "@peated/server/db";
import type { Bottle, BottleRelease, User } from "@peated/server/db/schema";
import {
  bottleGroupTombstones,
  bottleReleasePromotions,
  bottleTombstones,
  bottles,
} from "@peated/server/db/schema";
import { mergeConcreteBottles } from "@peated/server/lib/mergeConcreteBottles";
import * as testFixtures from "@peated/server/lib/test/fixtures";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

async function promoteRelease({
  parent,
  release,
  user: _user,
  edition,
}: {
  parent: Bottle;
  release: BottleRelease;
  user: User;
  edition: string;
}) {
  const bottle = await testFixtures.BottleGroupMember({
    groupId: parent.groupId as number,
    edition,
  });
  await db.insert(bottleReleasePromotions).values({
    releaseId: release.id,
    promotedBottleId: bottle.id,
    status: "promoted",
    completedAt: new Date(),
    createdByActorId: parent.createdByActorId,
  });
  return bottle;
}

describe("GET /bottle-releases/{release}/bottle", () => {
  test("resolves a completed legacy pair anonymously to its exact promoted Bottle", async ({
    defaults,
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({ name: "Redirect Parent" });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await promoteRelease({
      parent,
      release,
      user: defaults.user,
      edition: "Redirected Edition",
    });

    const result = await routerClient.bottleReleases.bottle({
      bottle: parent.id,
      release: release.id,
    });

    expect(result).toEqual({ bottleId: promoted.id });
  });

  test.each([
    { bottle: 0, release: 1 },
    { bottle: 1, release: -1 },
  ])("rejects non-positive legacy ids: %o", async (input) => {
    const error = await waitError(routerClient.bottleReleases.bottle(input));
    expect(error).toMatchObject({ status: 400 });
  });

  test("returns not found when the legacy release does not exist", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({ name: "Missing Release Parent" });

    const error = await waitError(
      routerClient.bottleReleases.bottle({
        bottle: parent.id,
        release: 999_999,
      }),
    );

    expect(error).toMatchObject({
      status: 404,
      message: "Legacy BottleRelease mapping not found.",
    });
  });

  test("returns not found when the release belongs to another parent", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({ name: "Expected Parent" });
    const otherParent = await fixtures.Bottle({ name: "Actual Parent" });
    const release = await fixtures.BottleRelease({
      bottleId: otherParent.id,
    });

    const error = await waitError(
      routerClient.bottleReleases.bottle({
        bottle: parent.id,
        release: release.id,
      }),
    );

    expect(error).toMatchObject({
      status: 404,
      message: "Legacy BottleRelease mapping not found.",
    });
  });

  test("returns conflict while a valid release lacks a completed promotion", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({ name: "Incomplete Parent" });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });

    const error = await waitError(
      routerClient.bottleReleases.bottle({
        bottle: parent.id,
        release: release.id,
      }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: expect.stringContaining(
        "release does not have a completed promotion mapping",
      ),
    });
  });

  test("uses the durable promotion after the promoted Bottle is regrouped", async ({
    defaults,
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({ name: "Regrouped Parent" });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await promoteRelease({
      parent,
      release,
      user: defaults.user,
      edition: "Regrouped Edition",
    });
    const newGroupAnchor = await fixtures.Bottle({
      name: "Regrouped Destination",
    });
    await db
      .update(bottles)
      .set({ groupId: newGroupAnchor.groupId })
      .where(eq(bottles.id, promoted.id));

    const result = await routerClient.bottleReleases.bottle({
      bottle: parent.id,
      release: release.id,
    });

    expect(result).toEqual({ bottleId: promoted.id });
  });
  test("returns conflict when the mapped promoted Bottle is retired", async ({
    defaults,
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({ name: "Retired Promoted Parent" });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await promoteRelease({
      parent,
      release,
      user: defaults.user,
      edition: "Retired Promoted Edition",
    });
    const replacement = await fixtures.Bottle({
      name: "Retired Promoted Replacement",
    });
    await db.insert(bottleTombstones).values({
      bottleId: promoted.id,
      newBottleId: replacement.id,
    });

    const error = await waitError(
      routerClient.bottleReleases.bottle({
        bottle: parent.id,
        release: release.id,
      }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: `Promoted Bottle ${promoted.id} is unavailable.`,
    });
  });

  test("returns conflict when the promoted BottleGroup is retired", async ({
    defaults,
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({ name: "Retired Group Parent" });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await promoteRelease({
      parent,
      release,
      user: defaults.user,
      edition: "Retired Group Edition",
    });
    const replacement = await fixtures.Bottle({
      name: "Retired Group Replacement",
    });
    await db.insert(bottleGroupTombstones).values({
      groupId: promoted.groupId as number,
      newGroupId: replacement.groupId as number,
      createdByActorId: promoted.createdByActorId,
    });

    const error = await waitError(
      routerClient.bottleReleases.bottle({
        bottle: parent.id,
        release: release.id,
      }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: `Promoted Bottle ${promoted.id} is unavailable.`,
    });
  });

  test("follows the canonical promotion repoint after an exact Bottle merge", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const parent = await fixtures.Bottle({ name: "Merged Redirect Parent" });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await promoteRelease({
      parent,
      release,
      user: mod,
      edition: "Merged Redirect Source",
    });
    const destination = await fixtures.Bottle({
      name: "Merged Redirect Destination",
    });

    await mergeConcreteBottles({
      sourceBottleId: promoted.id,
      destinationBottleId: destination.id,
      context: { user: mod },
    });

    const result = await routerClient.bottleReleases.bottle({
      bottle: parent.id,
      release: release.id,
    });

    expect(result).toEqual({ bottleId: destination.id });
  });
});
