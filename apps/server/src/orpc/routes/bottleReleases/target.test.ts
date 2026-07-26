import { db } from "@peated/server/db";
import type { Bottle, BottleRelease, User } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottleReleasePromotions,
  bottleTombstones,
  catalogTargets,
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
  const exactTarget = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottle.id),
  });
  if (!exactTarget) throw new Error("Missing exact target fixture.");
  await db.insert(bottleReleasePromotions).values({
    releaseId: release.id,
    promotedBottleId: bottle.id,
    status: "promoted",
    completedAt: new Date(),
    createdByActorId: parent.createdByActorId,
  });
  return { bottle, exactTarget };
}

describe("GET /bottle-releases/{release}/target", () => {
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

    const result = await routerClient.bottleReleases.target({
      bottle: parent.id,
      release: release.id,
    });

    expect(result).toEqual({ bottleId: promoted.bottle.id });
  });

  test.each([
    { bottle: 0, release: 1 },
    { bottle: 1, release: -1 },
  ])("rejects non-positive legacy ids: %o", async (input) => {
    const error = await waitError(routerClient.bottleReleases.target(input));
    expect(error).toMatchObject({ status: 400 });
  });

  test("returns not found when the legacy release does not exist", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({ name: "Missing Release Parent" });

    const error = await waitError(
      routerClient.bottleReleases.target({
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
      routerClient.bottleReleases.target({
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
      routerClient.bottleReleases.target({
        bottle: parent.id,
        release: release.id,
      }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: expect.stringContaining(
        "the release does not have a completed promotion mapping",
      ),
    });
  });

  test("returns conflict for a completed promotion into the wrong group", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({ name: "Corrupt Parent" });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const wrongGroupBottle = await fixtures.Bottle({
      name: "Wrong Group Promotion",
    });
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: wrongGroupBottle.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: parent.createdByActorId,
    });

    const error = await waitError(
      routerClient.bottleReleases.target({
        bottle: parent.id,
        release: release.id,
      }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: expect.stringContaining("integrity mismatch"),
    });
  });

  test("returns conflict when a completed promotion has lost its exact target", async ({
    defaults,
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({ name: "Missing Target Parent" });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await promoteRelease({
      parent,
      release,
      user: defaults.user,
      edition: "Missing Target Edition",
    });
    await db
      .delete(bottleAliases)
      .where(eq(bottleAliases.targetId, promoted.exactTarget.id));
    await db
      .delete(catalogTargets)
      .where(eq(catalogTargets.id, promoted.exactTarget.id));

    const error = await waitError(
      routerClient.bottleReleases.target({
        bottle: parent.id,
        release: release.id,
      }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: expect.stringContaining("integrity mismatch"),
    });
  });

  test("returns conflict when the mapped promoted Bottle is retired", async ({
    defaults,
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({ name: "Retired Target Parent" });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const promoted = await promoteRelease({
      parent,
      release,
      user: defaults.user,
      edition: "Retired Target Edition",
    });
    const replacement = await fixtures.Bottle({
      name: "Retired Target Replacement",
    });
    await db.insert(bottleTombstones).values({
      bottleId: promoted.bottle.id,
      newBottleId: replacement.id,
    });

    const error = await waitError(
      routerClient.bottleReleases.target({
        bottle: parent.id,
        release: release.id,
      }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: `Catalog target is retired (bottleId=${promoted.bottle.id}).`,
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
      sourceBottleId: promoted.bottle.id,
      destinationBottleId: destination.id,
      context: { user: mod },
    });

    const result = await routerClient.bottleReleases.target({
      bottle: parent.id,
      release: release.id,
    });

    expect(result).toEqual({ bottleId: destination.id });
  });
});
