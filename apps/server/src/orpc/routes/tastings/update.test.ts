import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import {
  bottleReleasePromotions,
  bottleTags,
  bottles,
  catalogTargets,
  tastings,
} from "@peated/server/db/schema";
import { omit } from "@peated/server/lib/filter";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import pg from "pg";
import { beforeEach, vi } from "vitest";

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

async function waitForSessionBlockedBy(
  client: NodePgClient,
  blockerPid: number,
): Promise<void> {
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
  throw new Error("Timed out waiting for tasting update to request its lock.");
}

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

describe("PUT /tastings/:tasting", () => {
  beforeEach(() => {
    vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
  });

  test("requires auth", async () => {
    const err = await waitError(routerClient.tastings.update({ tasting: 1 }));
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("cannot update another users tasting", async ({
    defaults,
    fixtures,
  }) => {
    const tasting = await fixtures.Tasting();
    const err = await waitError(
      routerClient.tastings.update(
        { tasting: tasting.id },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Tasting not found.]`);
  });

  test("rejects catalog identity fields instead of stripping them", async ({
    defaults,
    fixtures,
  }) => {
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
      notes: "unchanged",
    });
    const identityFields = [
      { target: 1 },
      { bottle: 1 },
      { release: 1 },
      { targetId: 1 },
      { bottleId: 1 },
      { releaseId: 1 },
    ];

    for (const identityField of identityFields) {
      const error = await waitError(() =>
        routerClient.tastings.update(
          {
            tasting: tasting.id,
            notes: "must not persist",
            ...identityField,
          } as never,
          { context: { user: defaults.user } },
        ),
      );
      expect(error).toMatchObject({ message: "Input validation failed" });
    }

    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, tasting.id),
        columns: { notes: true },
      }),
    ).toEqual({ notes: "unchanged" });
  });

  test("no changes", async ({ defaults, fixtures }) => {
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
    });

    const data = await routerClient.tastings.update(
      { tasting: tasting.id },
      { context: { user: defaults.user } },
    );

    expect(data.id).toBeDefined();

    const [newTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.id));

    expect(tasting).toEqual(newTasting);
  });

  test("updates rating", async ({ defaults, fixtures }) => {
    // Use rating: 2 to ensure the update to rating: 1 actually triggers a change
    // This avoids flakiness when the fixture randomly picks the same rating
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
      rating: 2,
    });

    const data = await routerClient.tastings.update(
      {
        tasting: tasting.id,
        rating: 1,
      },
      { context: { user: defaults.user } },
    );

    expect(data.id).toBeDefined();

    const [newTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.id));

    expect(omit(tasting, "rating")).toEqual(omit(newTasting, "rating"));
    expect(newTasting.rating).toEqual(1);

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, newTasting.bottleId!));
    expect(bottle.avgRating).toBeNull();
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { targetId: tasting.targetId },
      STATS_JOB_OPTIONS,
    );
  });

  test("updates notes", async ({ defaults, fixtures }) => {
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
    });

    const data = await routerClient.tastings.update(
      {
        tasting: tasting.id,
        notes: "hello world",
      },
      { context: { user: defaults.user } },
    );

    expect(data.id).toBeDefined();

    const [newTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.id));

    expect(omit(tasting, "notes")).toEqual(omit(newTasting, "notes"));
    expect(newTasting.notes).toEqual("hello world");
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("backfills a missing exact target and schedules exact stats", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: null,
      createdById: defaults.user.id,
    });

    await routerClient.tastings.update(
      { tasting: tasting.id, notes: "backfilled" },
      { context: { user: defaults.user } },
    );

    const persisted = await db.query.tastings.findFirst({
      where: eq(tastings.id, tasting.id),
    });
    const target = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { eq }) => eq(catalogTargets.bottleId, bottle.id),
    });
    expect(persisted?.targetId).toBe(target?.id);
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { targetId: target?.id },
      STATS_JOB_OPTIONS,
    );
  });

  test("uses a durable target without resolving an invalid legacy pair", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const target = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { eq }) => eq(catalogTargets.bottleId, bottle.id),
    });
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: target?.id,
      createdById: defaults.user.id,
    });

    const result = await routerClient.tastings.update(
      { tasting: tasting.id, notes: "durable" },
      { context: { user: defaults.user } },
    );

    expect(result.notes).toBe("durable");
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("dispatches a durable generic target without resolving an unmapped release", async ({
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
      rating: 2,
      createdById: defaults.user.id,
    });

    const result = await routerClient.tastings.update(
      { tasting: tasting.id, rating: 1 },
      { context: { user: defaults.user } },
    );

    expect(result.rating).toBe(1);
    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, tasting.id),
        columns: { targetId: true },
      }),
    ).toEqual({ targetId: target!.id });
    expect(workerClient.pushJob).toHaveBeenCalledTimes(1);
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleGroupStats",
      { targetId: target!.id },
      STATS_JOB_OPTIONS,
    );
  });

  test("routes from the locked target when another transaction backfills it", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const target = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { and, eq, isNull }) =>
        and(
          eq(catalogTargets.groupId, bottle.groupId as number),
          isNull(catalogTargets.bottleId),
        ),
    });
    expect(target).toBeDefined();
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: null,
      rating: 2,
      createdById: defaults.user.id,
    });

    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let updatePromise:
      | ReturnType<typeof routerClient.tastings.update>
      | undefined;
    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        'UPDATE "tasting" SET "target_id" = $1 WHERE "id" = $2',
        [target!.id, tasting.id],
      );

      updatePromise = routerClient.tastings.update(
        { tasting: tasting.id, rating: 1 },
        { context: { user: defaults.user } },
      );
      await waitForSessionBlockedBy(client, blockerPid);
      await client.query("COMMIT");
      committed = true;

      const result = await updatePromise;
      expect(result.rating).toBe(1);
      expect(
        await db.query.tastings.findFirst({
          where: eq(tastings.id, tasting.id),
          columns: { targetId: true },
        }),
      ).toEqual({ targetId: target!.id });
      expect(workerClient.pushJob).toHaveBeenCalledTimes(1);
      expect(workerClient.pushJob).toHaveBeenCalledWith(
        "UpdateBottleGroupStats",
        { targetId: target!.id },
        STATS_JOB_OPTIONS,
      );
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await updatePromise?.catch(() => undefined);
    }
  });

  test("backfills and dispatches a generic target when rating changes", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: bottle.id });
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: null,
      rating: 2,
      createdById: defaults.user.id,
    });

    await routerClient.tastings.update(
      { tasting: tasting.id, rating: 1 },
      { context: { user: defaults.user } },
    );

    const persisted = await db.query.tastings.findFirst({
      where: eq(tastings.id, tasting.id),
    });
    const target = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { and, eq, isNull }) =>
        and(
          eq(catalogTargets.groupId, bottle.groupId as number),
          isNull(catalogTargets.bottleId),
        ),
    });
    expect(persisted?.targetId).toBe(target?.id);
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleGroupStats",
      { targetId: target?.id },
      STATS_JOB_OPTIONS,
    );
  });

  test("rolls back a null-target repair that collides on durable identity", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const firstRelease = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Update Collision First Edition",
      name: "Update Collision First",
      fullName: "Fixture Update Collision First",
    });
    const secondRelease = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Update Collision Second Edition",
      name: "Update Collision Second",
      fullName: "Fixture Update Collision Second",
    });
    await promoteRelease(firstRelease.id, bottle.id, bottle.createdByActorId);
    await promoteRelease(secondRelease.id, bottle.id, bottle.createdByActorId);

    const target = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { eq }) => eq(catalogTargets.bottleId, bottle.id),
    });
    expect(target).toBeDefined();

    const createdAt = new Date("2026-07-16T12:34:56.000Z");
    await fixtures.Tasting({
      bottleId: bottle.id,
      releaseId: firstRelease.id,
      targetId: target!.id,
      createdById: defaults.user.id,
      createdAt,
    });
    const legacyTasting = await fixtures.Tasting({
      bottleId: bottle.id,
      releaseId: secondRelease.id,
      targetId: null,
      createdById: defaults.user.id,
      createdAt,
      notes: "before collision",
      rating: 2,
    });

    const err = await waitError(() =>
      routerClient.tastings.update(
        {
          tasting: legacyTasting.id,
          notes: "must roll back",
          rating: 1,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Tasting already exists.]`);
    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, legacyTasting.id),
        columns: { targetId: true, notes: true, rating: true },
      }),
    ).toEqual({
      targetId: null,
      notes: "before collision",
      rating: 2,
    });
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("updates tags", async ({ defaults, fixtures }) => {
    const tag = await fixtures.Tag();
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
    });

    const data = await routerClient.tastings.update(
      {
        tasting: tasting.id,
        tags: [tag.name],
      },
      { context: { user: defaults.user } },
    );

    expect(data.id).toBeDefined();

    const [newTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.id));

    expect(omit(tasting, "tags")).toEqual(omit(newTasting, "tags"));
    expect(newTasting.tags).toEqual([tag.name]);

    const tagList = await db
      .select()
      .from(bottleTags)
      .where(
        and(
          eq(bottleTags.bottleId, newTasting.bottleId!),
          gt(bottleTags.count, 0),
        ),
      );

    expect(tagList.length).toEqual(1);
    expect(tagList[0].tag).toEqual(tag.name);
    expect(tagList[0].count).toEqual(1);
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("updates promoted exact tags on the target Bottle despite retained-pair drift", async ({
    defaults,
    fixtures,
  }) => {
    const [oldTag, newTag] = await Promise.all([
      fixtures.Tag({ name: "promoted-update-old" }),
      fixtures.Tag({ name: "promoted-update-new" }),
    ]);
    const retainedBottle = await fixtures.Bottle();
    const [promotedBottle] = await db
      .insert(bottles)
      .values({
        groupId: retainedBottle.groupId,
        brandId: retainedBottle.brandId,
        createdByActorId: retainedBottle.createdByActorId,
        name: `${retainedBottle.name} promoted update`,
        fullName: `${retainedBottle.fullName} promoted update`,
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
        tags: [oldTag.name],
      },
      { context: { user: defaults.user } },
    );
    vi.mocked(workerClient.pushJob).mockClear();

    await routerClient.tastings.update(
      { tasting: created.tasting.id, tags: [newTag.name] },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, created.tasting.id),
        columns: {
          bottleId: true,
          releaseId: true,
          targetId: true,
          tags: true,
        },
      }),
    ).toEqual({
      bottleId: retainedBottle.id,
      releaseId: release.id,
      targetId: target.id,
      tags: [newTag.name],
    });
    expect(
      await db.query.bottleTags.findMany({
        where: and(
          eq(bottleTags.bottleId, promotedBottle.id),
          inArray(bottleTags.tag, [oldTag.name, newTag.name]),
        ),
        orderBy: (table, { asc }) => asc(table.tag),
      }),
    ).toEqual([
      expect.objectContaining({ tag: newTag.name, count: 1 }),
      expect.objectContaining({ tag: oldTag.name, count: 0 }),
    ]);
    expect(
      await db.query.bottleTags.findMany({
        where: and(
          eq(bottleTags.bottleId, retainedBottle.id),
          inArray(bottleTags.tag, [oldTag.name, newTag.name]),
        ),
      }),
    ).toEqual([]);
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("updates generic target tags without exact Bottle attribution", async ({
    defaults,
    fixtures,
  }) => {
    const [oldTag, newTag] = await Promise.all([
      fixtures.Tag({ name: "generic-update-old" }),
      fixtures.Tag({ name: "generic-update-new" }),
    ]);
    const memberBottle = await fixtures.Bottle();
    const target = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, memberBottle.groupId as number),
        isNull(catalogTargets.bottleId),
      ),
    });
    if (!target) throw new Error("Missing generic target fixture");
    const created = await routerClient.tastings.create(
      { target: target.id, tags: [oldTag.name] },
      { context: { user: defaults.user } },
    );
    vi.mocked(workerClient.pushJob).mockClear();

    await routerClient.tastings.update(
      { tasting: created.tasting.id, tags: [newTag.name] },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, created.tasting.id),
        columns: { bottleId: true, targetId: true, tags: true },
      }),
    ).toEqual({
      bottleId: null,
      targetId: target.id,
      tags: [newTag.name],
    });
    expect(
      await db.query.bottleTags.findMany({
        where: and(
          eq(bottleTags.bottleId, memberBottle.id),
          inArray(bottleTags.tag, [oldTag.name, newTag.name]),
        ),
      }),
    ).toEqual([]);
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });
});
