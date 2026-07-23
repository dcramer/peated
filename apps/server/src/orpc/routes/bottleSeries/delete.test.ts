import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import type { User } from "@peated/server/db/schema";
import {
  bottleGroups,
  bottles,
  bottleSeries,
  catalogTargets,
  changes,
} from "@peated/server/db/schema";
import { createConcreteBottle } from "@peated/server/lib/createConcreteBottle";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { and, asc, eq, inArray } from "drizzle-orm";
import pg from "pg";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

vi.mock("@peated/server/worker/client", () => ({
  pushUniqueJob: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(workerClient.pushUniqueJob).mockReset();
});

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
  throw new Error("Timed out waiting for BottleSeries deletion group lock.");
}

async function createGroup({
  user,
  brandId,
  seriesId,
  name,
}: {
  user: User;
  brandId: number;
  seriesId: number;
  name: string;
}) {
  const first = await createConcreteBottle({
    context: { user },
    input: {
      kind: "independent",
      stable: { name, brand: brandId, series: seriesId },
      exact: { edition: "Batch One" },
    },
  });
  const second = await createConcreteBottle({
    context: { user },
    input: {
      kind: "source_bottle",
      sourceBottleId: first.bottle.id,
      exact: { edition: "Batch Two" },
    },
  });
  return { first, members: [first, second] };
}

describe("DELETE /bottle-series/:series", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.bottleSeries.delete({
        series: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires moderator access", async ({ defaults }) => {
    const err = await waitError(() =>
      routerClient.bottleSeries.delete(
        {
          series: 1,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("deletes a series through canonical group fan-out and legacy clearing", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const brand = await fixtures.Entity({ name: "Series Delete Brand" });
    const series = await fixtures.BottleSeries({
      name: "Test Series",
      brandId: brand.id,
    });
    const firstGroup = await createGroup({
      user,
      brandId: brand.id,
      seriesId: series.id,
      name: "First Expression",
    });
    const secondGroup = await createGroup({
      user,
      brandId: brand.id,
      seriesId: series.id,
      name: "Second Expression",
    });
    const groupedMembers = [...firstGroup.members, ...secondGroup.members];
    const groupedBottleIds = groupedMembers.map(({ bottle }) => bottle.id);
    const groupIds = [firstGroup.first.group.id, secondGroup.first.group.id];
    const targetsBefore = await db
      .select()
      .from(catalogTargets)
      .where(inArray(catalogTargets.bottleId, groupedBottleIds))
      .orderBy(asc(catalogTargets.id));
    const legacyBottle = await fixtures.LegacyBottle({
      name: "Legacy Bottle",
      brandId: brand.id,
      seriesId: series.id,
    });

    let finalizedAfterCommit = false;
    vi.mocked(workerClient.pushUniqueJob).mockReset();
    vi.mocked(workerClient.pushUniqueJob).mockImplementation(
      async (jobName) => {
        if (jobName === "OnBottleChange") {
          finalizedAfterCommit =
            (await db.query.bottleSeries.findFirst({
              where: eq(bottleSeries.id, series.id),
            })) === undefined;
        }
      },
    );

    await routerClient.bottleSeries.delete(
      {
        series: series.id,
      },
      { context: { user } },
    );

    expect(
      await db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, series.id),
      }),
    ).toBeUndefined();
    expect(finalizedAfterCommit).toBe(true);

    const updatedGroups = await db
      .select()
      .from(bottleGroups)
      .where(inArray(bottleGroups.id, groupIds))
      .orderBy(asc(bottleGroups.id));
    expect(updatedGroups).toHaveLength(2);
    expect(updatedGroups.every(({ seriesId }) => seriesId === null)).toBe(true);

    const updatedBottles = await db
      .select()
      .from(bottles)
      .where(inArray(bottles.id, [...groupedBottleIds, legacyBottle.id]))
      .orderBy(asc(bottles.id));
    expect(updatedBottles).toHaveLength(5);
    expect(updatedBottles.every(({ seriesId }) => seriesId === null)).toBe(
      true,
    );

    const targetsAfter = await db
      .select()
      .from(catalogTargets)
      .where(inArray(catalogTargets.bottleId, groupedBottleIds))
      .orderBy(asc(catalogTargets.id));
    expect(targetsAfter).toEqual(targetsBefore);

    const bottleAudits = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "bottle"),
          eq(changes.type, "update"),
          inArray(changes.objectId, [...groupedBottleIds, legacyBottle.id]),
        ),
      )
      .orderBy(asc(changes.objectId));
    const expectedAuditContext = new Map([
      ...firstGroup.members.map(
        ({ bottle }) =>
          [
            bottle.id,
            {
              groupId: firstGroup.first.group.id,
              requestedBottleId: firstGroup.first.bottle.id,
            },
          ] as const,
      ),
      ...secondGroup.members.map(
        ({ bottle }) =>
          [
            bottle.id,
            {
              groupId: secondGroup.first.group.id,
              requestedBottleId: secondGroup.first.bottle.id,
            },
          ] as const,
      ),
    ]);
    expect(bottleAudits).toHaveLength(4);
    for (const audit of bottleAudits) {
      expect(audit.data).toMatchObject({
        seriesId: null,
        updateScope: "shared",
        ...expectedAuditContext.get(audit.objectId),
      });
    }
    expect(bottleAudits.map(({ objectId }) => objectId)).toEqual(
      groupedBottleIds.sort((left, right) => left - right),
    );

    const [change] = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectId, series.id),
          eq(changes.objectType, "bottle_series"),
        ),
      );
    expect(change).toBeDefined();
    expect(change?.type).toBe("delete");
    expect(change?.data).toMatchObject({
      id: series.id,
      name: series.name,
      description: series.description,
      brandId: series.brandId,
    });

    const expectedTargetIds = targetsBefore.map(({ id }) => id);
    const changedTargetIds = vi
      .mocked(workerClient.pushUniqueJob)
      .mock.calls.filter(([jobName]) => jobName === "OnBottleChange")
      .map(([, payload]) => (payload as { targetId: number }).targetId)
      .sort((left, right) => left - right);
    expect(changedTargetIds).toEqual(expectedTargetIds);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalledWith(
      "IndexBottleSeriesSearchVectors",
      { seriesId: series.id },
    );
  });

  test("rolls back earlier group fan-out when a later group is invalid", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const brand = await fixtures.Entity({ name: "Atomic Delete Brand" });
    const series = await fixtures.BottleSeries({
      name: "Atomic Delete Series",
      brandId: brand.id,
    });
    const validGroup = await createGroup({
      user,
      brandId: brand.id,
      seriesId: series.id,
      name: "Valid Expression",
    });
    const invalidGroup = await createGroup({
      user,
      brandId: brand.id,
      seriesId: series.id,
      name: "Invalid Expression",
    });
    await db
      .update(bottleGroups)
      .set({ representativeBottleId: null })
      .where(eq(bottleGroups.id, invalidGroup.first.group.id));
    const groupedBottleIds = [...validGroup.members, ...invalidGroup.members]
      .map(({ bottle }) => bottle.id)
      .sort((left, right) => left - right);
    const seriesBefore = await db.query.bottleSeries.findFirst({
      where: eq(bottleSeries.id, series.id),
    });
    vi.mocked(workerClient.pushUniqueJob).mockReset();

    const error = await waitError(() =>
      routerClient.bottleSeries.delete(
        { series: series.id },
        { context: { user } },
      ),
    );
    expect(error.message).toBe(
      `BottleGroup ${invalidGroup.first.group.id} has no representative Bottle.`,
    );

    expect(
      await db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, series.id),
      }),
    ).toEqual(seriesBefore);
    const groups = await db
      .select()
      .from(bottleGroups)
      .where(
        inArray(bottleGroups.id, [
          validGroup.first.group.id,
          invalidGroup.first.group.id,
        ]),
      );
    expect(groups.every(({ seriesId }) => seriesId === series.id)).toBe(true);
    const members = await db
      .select()
      .from(bottles)
      .where(inArray(bottles.id, groupedBottleIds));
    expect(members.every(({ seriesId }) => seriesId === series.id)).toBe(true);
    expect(
      await db
        .select()
        .from(changes)
        .where(
          and(
            eq(changes.objectType, "bottle"),
            eq(changes.type, "update"),
            inArray(changes.objectId, groupedBottleIds),
          ),
        ),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(changes)
        .where(
          and(
            eq(changes.objectType, "bottle_series"),
            eq(changes.objectId, series.id),
            eq(changes.type, "delete"),
          ),
        ),
    ).toEqual([]);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("does not overwrite a concurrent group series move", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const brand = await fixtures.Entity({ name: "Concurrent Series Brand" });
    const deletedSeries = await fixtures.BottleSeries({
      name: "Deleted Series",
      brandId: brand.id,
    });
    const destinationSeries = await fixtures.BottleSeries({
      name: "Destination Series",
      brandId: brand.id,
    });
    const group = await createGroup({
      user,
      brandId: brand.id,
      seriesId: deletedSeries.id,
      name: "Concurrent Expression",
    });
    const memberIds = group.members.map(({ bottle }) => bottle.id);
    vi.mocked(workerClient.pushUniqueJob).mockReset();

    const mover = new Client(getPostgresConnectionConfig());
    let moverCommitted = false;
    let deletion:
      | ReturnType<typeof routerClient.bottleSeries.delete>
      | undefined;
    await mover.connect();
    try {
      await mover.query("BEGIN");
      await mover.query(
        `SELECT id
         FROM bottle_group
         WHERE id = $1
         FOR UPDATE`,
        [group.first.group.id],
      );

      deletion = routerClient.bottleSeries.delete(
        { series: deletedSeries.id },
        { context: { user } },
      );
      void deletion.catch(() => undefined);
      await waitForSessionBlockedBy(mover);

      await mover.query(
        `UPDATE bottle_group
         SET series_id = $2
         WHERE id = $1`,
        [group.first.group.id, destinationSeries.id],
      );
      await mover.query(
        `UPDATE bottle
         SET series_id = $2
         WHERE group_id = $1`,
        [group.first.group.id, destinationSeries.id],
      );
      await mover.query("COMMIT");
      moverCommitted = true;

      await deletion;
    } finally {
      if (!moverCommitted) await mover.query("ROLLBACK").catch(() => undefined);
      await deletion?.catch(() => undefined);
      await mover.end();
    }

    expect(
      await db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, deletedSeries.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, group.first.group.id),
      }),
    ).toMatchObject({ seriesId: destinationSeries.id });
    const members = await db
      .select()
      .from(bottles)
      .where(inArray(bottles.id, memberIds));
    expect(members).toHaveLength(2);
    expect(
      members.every(({ seriesId }) => seriesId === destinationSeries.id),
    ).toBe(true);
    expect(
      await db
        .select()
        .from(changes)
        .where(
          and(
            eq(changes.objectType, "bottle"),
            eq(changes.type, "update"),
            inArray(changes.objectId, memberIds),
          ),
        ),
    ).toEqual([]);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("returns 404 for non-existent series", async function ({ fixtures }) {
    const user = await fixtures.User({ admin: true });

    const err = await waitError(() =>
      routerClient.bottleSeries.delete(
        {
          series: 12345,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Series not found.]`);
  });
});
