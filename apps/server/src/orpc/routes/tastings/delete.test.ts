import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import {
  bottleReleasePromotions,
  bottleTags,
  bottles,
  catalogTargets,
  tastings,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { and, eq, inArray, isNull } from "drizzle-orm";
import pg from "pg";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

vi.mock("@peated/server/worker/client", async (importOriginal) => ({
  ...(await importOriginal<typeof workerClient>()),
  pushJob: vi.fn().mockResolvedValue(undefined),
}));

const STATS_JOB_OPTIONS = {
  delay: 5000,
  removeOnComplete: true,
  removeOnFail: false,
};

async function promoteRelease(
  releaseId: number,
  bottleId: number,
  createdByActorId: number,
) {
  await db.insert(bottleReleasePromotions).values({
    releaseId,
    promotedBottleId: bottleId,
    status: "promoted",
    completedAt: new Date(),
    createdByActorId,
  });
}

async function waitForSessionBlockedBy(client: NodePgClient): Promise<void> {
  const session = await client.query<{ pid: number }>(
    "SELECT pg_backend_pid() AS pid",
  );
  const blockerPid = session.rows[0]?.pid;
  if (!blockerPid) throw new Error("Unable to identify the lock holder.");

  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await client.query<{ blocked: boolean }>(
      `SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity
        WHERE $1 = ANY(pg_blocking_pids(pid))
      ) AS blocked`,
      [blockerPid],
    );
    if (result.rows[0]?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for tasting delete to request its lock.");
}

describe("DELETE /tastings/:tasting", () => {
  beforeEach(() => {
    vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
  });

  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.tastings.delete({ tasting: 1 }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("delete own tasting", async ({ defaults, fixtures }) => {
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
      tags: ["spiced", "caramel"],
    });

    await routerClient.tastings.delete(
      { tasting: tasting.id },
      {
        context: { user: defaults.user },
      },
    );

    const [newTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, tasting.id));
    expect(newTasting).toBeUndefined();

    const tags = await db
      .select()
      .from(bottleTags)
      .where(eq(bottleTags.bottleId, tasting.bottleId!));

    expect(tags.length).toBe(2);
    for (const tag of tags) {
      expect(tag.count).toBe(0);
    }

    const bottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, tasting.bottleId!),
    });
    expect(bottle?.totalTastings).toBe(0);
    expect(bottle?.avgRating).toBeNull();
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { targetId: tasting.targetId },
      STATS_JOB_OPTIONS,
    );
  });

  test("deletes promoted exact tags from the target Bottle despite retained-pair drift", async ({
    defaults,
    fixtures,
  }) => {
    const tag = await fixtures.Tag({ name: "promoted-delete" });
    const retainedBottle = await fixtures.Bottle();
    const [promotedBottle] = await db
      .insert(bottles)
      .values({
        groupId: retainedBottle.groupId,
        brandId: retainedBottle.brandId,
        createdByActorId: retainedBottle.createdByActorId,
        name: `${retainedBottle.name} promoted delete`,
        fullName: `${retainedBottle.fullName} promoted delete`,
      })
      .returning();
    if (!promotedBottle) throw new Error("Missing promoted Bottle fixture");
    const [target] = await db
      .insert(catalogTargets)
      .values({
        groupId: retainedBottle.groupId as number,
        bottleId: promotedBottle.id,
      })
      .returning();
    if (!target) throw new Error("Missing promoted target fixture");
    const release = await fixtures.BottleRelease({
      bottleId: retainedBottle.id,
    });
    await promoteRelease(
      release.id,
      promotedBottle.id,
      retainedBottle.createdByActorId,
    );
    const created = await routerClient.tastings.create(
      {
        bottle: retainedBottle.id,
        release: release.id,
        tags: [tag.name],
      },
      { context: { user: defaults.user } },
    );
    vi.mocked(workerClient.pushJob).mockClear();

    await routerClient.tastings.delete(
      { tasting: created.tasting.id },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.bottleTags.findFirst({
        where: and(
          eq(bottleTags.bottleId, promotedBottle.id),
          eq(bottleTags.tag, tag.name),
        ),
      }),
    ).toMatchObject({ count: 0 });
    expect(
      await db.query.bottleTags.findMany({
        where: and(
          eq(bottleTags.bottleId, retainedBottle.id),
          eq(bottleTags.tag, tag.name),
        ),
      }),
    ).toEqual([]);
    expect(workerClient.pushJob).toHaveBeenCalledTimes(1);
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { targetId: target.id },
      STATS_JOB_OPTIONS,
    );
  });

  test("deletes generic target tags without exact Bottle attribution", async ({
    defaults,
    fixtures,
  }) => {
    const tag = await fixtures.Tag({ name: "generic-delete" });
    const memberBottle = await fixtures.Bottle();
    const target = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, memberBottle.groupId as number),
        isNull(catalogTargets.bottleId),
      ),
    });
    if (!target) throw new Error("Missing generic target fixture");
    const created = await routerClient.tastings.create(
      { target: target.id, tags: [tag.name] },
      { context: { user: defaults.user } },
    );
    vi.mocked(workerClient.pushJob).mockClear();

    await routerClient.tastings.delete(
      { tasting: created.tasting.id },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.bottleTags.findMany({
        where: and(
          eq(bottleTags.bottleId, memberBottle.id),
          inArray(bottleTags.tag, [tag.name]),
        ),
      }),
    ).toEqual([]);
    expect(workerClient.pushJob).toHaveBeenCalledTimes(1);
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleGroupStats",
      { targetId: target.id },
      STATS_JOB_OPTIONS,
    );
  });

  test("resolves a missing generic target and retains its Bottle for stats", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: bottle.id });
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: null,
      createdById: defaults.user.id,
    });
    const target = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { and, eq, isNull }) =>
        and(
          eq(catalogTargets.groupId, bottle.groupId as number),
          isNull(catalogTargets.bottleId),
        ),
    });
    if (!target) throw new Error("Missing generic target fixture");

    await routerClient.tastings.delete(
      { tasting: tasting.id },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, tasting.id),
      }),
    ).toBeUndefined();
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleGroupStats",
      { targetId: target.id },
      STATS_JOB_OPTIONS,
    );
  });

  test("trusts a durable generic target over an unmapped legacy release", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const target = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { and, eq, isNull }) =>
        and(
          eq(catalogTargets.groupId, bottle.groupId as number),
          isNull(catalogTargets.bottleId),
        ),
    });
    expect(target).toBeDefined();
    expect(
      await db.query.bottleReleasePromotions.findFirst({
        where: (promotions, { eq }) => eq(promotions.releaseId, release.id),
      }),
    ).toBeUndefined();
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: target!.id,
      createdById: defaults.user.id,
    });

    await routerClient.tastings.delete(
      { tasting: tasting.id },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, tasting.id),
      }),
    ).toBeUndefined();
    expect(workerClient.pushJob).toHaveBeenCalledTimes(1);
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleGroupStats",
      { targetId: target!.id },
      STATS_JOB_OPTIONS,
    );
  });

  test("dispatches from the current locked target instead of the earlier snapshot", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const exactTarget = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { eq }) => eq(catalogTargets.bottleId, bottle.id),
    });
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { and, eq, isNull }) =>
        and(
          eq(catalogTargets.groupId, bottle.groupId as number),
          isNull(catalogTargets.bottleId),
        ),
    });
    expect(exactTarget).toBeDefined();
    expect(genericTarget).toBeDefined();
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: exactTarget!.id,
      createdById: defaults.user.id,
    });

    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let deletion: ReturnType<typeof routerClient.tastings.delete> | undefined;
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        'UPDATE "tasting" SET "target_id" = $1 WHERE "id" = $2',
        [genericTarget!.id, tasting.id],
      );

      deletion = routerClient.tastings.delete(
        { tasting: tasting.id },
        { context: { user: defaults.user } },
      );
      await waitForSessionBlockedBy(client);
      await client.query("COMMIT");
      committed = true;

      await deletion;
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await deletion?.catch(() => undefined);
    }

    expect(workerClient.pushJob).toHaveBeenCalledTimes(1);
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleGroupStats",
      { targetId: genericTarget!.id },
      STATS_JOB_OPTIONS,
    );
  });

  test("cannot delete others tasting", async ({ defaults, fixtures }) => {
    const user = await fixtures.User();
    const tasting = await fixtures.Tasting({ createdById: user.id });

    const err = await waitError(() =>
      routerClient.tastings.delete(
        { tasting: tasting.id },
        {
          context: { user: defaults.user },
        },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot delete another user's tasting.]`,
    );
  });
});
