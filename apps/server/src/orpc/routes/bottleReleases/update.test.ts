import { db } from "@peated/server/db";
import {
  bottleReleasePromotions,
  bottleReleases,
  bottles,
  changes,
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

  test("returns not found when the retained release does not exist", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const error = await waitError(
      routerClient.bottleReleases.update(
        { release: 999_999, edition: "Missing" },
        { context: { user: mod } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Release not found.]`);
  });

  test("rejects a missing promotion mapping without writes", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const parent = await fixtures.Bottle({ name: "Missing Update Mapping" });
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const bottlesBefore = await db
      .select()
      .from(bottles)
      .orderBy(asc(bottles.id));
    const releasesBefore = await db
      .select()
      .from(bottleReleases)
      .orderBy(asc(bottleReleases.id));
    const changesBefore = await db
      .select()
      .from(changes)
      .orderBy(asc(changes.id));

    const error = await waitError(
      routerClient.bottleReleases.update(
        { release: release.id, edition: "Must not apply" },
        { context: { user: mod } },
      ),
    );

    expect(error).toMatchObject({ status: 409 });
    expect(await db.select().from(bottles).orderBy(asc(bottles.id))).toEqual(
      bottlesBefore,
    );
    expect(
      await db.select().from(bottleReleases).orderBy(asc(bottleReleases.id)),
    ).toEqual(releasesBefore);
    expect(await db.select().from(changes).orderBy(asc(changes.id))).toEqual(
      changesBefore,
    );
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("refuses the legacy write with an explicit Bottle replacement", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const parent = await fixtures.Bottle({ name: "Mapped Update Parent" });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      edition: "Legacy Batch",
    });
    const promoted = await fixtures.BottleGroupMember({
      groupId: parent.groupId as number,
      edition: "Mapped Batch",
    });
    await promoteRelease(release.id, promoted.id);

    const bottleBefore = await db.query.bottles.findFirst({
      where: eq(bottles.id, promoted.id),
    });
    const releaseBefore = await db.query.bottleReleases.findFirst({
      where: eq(bottleReleases.id, release.id),
    });
    const changesBefore = await db
      .select()
      .from(changes)
      .orderBy(asc(changes.id));
    vi.clearAllMocks();

    const error = await waitError(
      routerClient.bottleReleases.update(
        {
          release: release.id,
          edition: "Must not apply",
          description: null,
        },
        { context: { user: mod } },
      ),
    );

    expect(error).toMatchObject({
      status: 409,
      message: `BottleRelease ${release.id} maps to Bottle ${promoted.id}; update that Bottle through PATCH /bottles/${promoted.id} instead.`,
      data: { bottle: promoted.id },
    });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, promoted.id),
      }),
    ).toEqual(bottleBefore);
    expect(
      await db.query.bottleReleases.findFirst({
        where: eq(bottleReleases.id, release.id),
      }),
    ).toEqual(releaseBefore);
    expect(await db.select().from(changes).orderBy(asc(changes.id))).toEqual(
      changesBefore,
    );
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });
});
