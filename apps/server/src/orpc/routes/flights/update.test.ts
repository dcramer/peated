import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import {
  bottles as bottleTable,
  bottleTombstones,
  catalogTargets,
  flightBottles,
  flights,
} from "@peated/server/db/schema";
import { omit } from "@peated/server/lib/filter";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";
import pg from "pg";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

async function waitForSessionsBlockedBy(
  client: NodePgClient,
  blockerPid: number,
  expectedCount: number,
): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM pg_stat_activity
       WHERE $1 = ANY(pg_blocking_pids(pid))`,
      [blockerPid],
    );
    if ((result.rows[0]?.count ?? 0) >= expectedCount) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for flight target locks.");
}

describe("PATCH /flights/:flight", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.flights.update({
        flight: "1",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod", async ({ fixtures }) => {
    const user = await fixtures.User();
    const flight = await fixtures.Flight();

    const err = await waitError(
      routerClient.flights.update(
        {
          flight: flight.publicId,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot update another user's flight.]`,
    );
  });

  test("no changes", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const flight = await fixtures.Flight();

    const data = await routerClient.flights.update(
      {
        flight: flight.publicId,
      },
      { context: { user } },
    );

    expect(data.id).toBeDefined();

    const [newFlight] = await db
      .select()
      .from(flights)
      .where(eq(flights.publicId, data.id));

    expect(flight).toEqual(newFlight);
  });

  test("can change name", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const flight = await fixtures.Flight();

    const data = await routerClient.flights.update(
      {
        flight: flight.publicId,
        name: "Delicious Wood",
      },
      { context: { user } },
    );

    expect(data.id).toBeDefined();

    const [newFlight] = await db
      .select()
      .from(flights)
      .where(eq(flights.publicId, data.id));

    expect(omit(flight, "name")).toEqual(omit(newFlight, "name"));
    expect(newFlight.name).toBe("Delicious Wood");
  });

  test("metadata-only updates preserve target-aware memberships", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const flight = await fixtures.Flight({ bottles: [bottle.id] });
    const before = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(before[0]?.targetId).not.toBeNull();

    await routerClient.flights.update(
      { flight: flight.publicId, name: "Metadata only" },
      { context: { user } },
    );

    const after = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(after).toEqual(before);
  });

  test("metadata-only updates recheck ownership at mutation time", async ({
    fixtures,
  }) => {
    const owner = await fixtures.User();
    const newOwner = await fixtures.User();
    const flight = await fixtures.Flight({ createdById: owner.id });
    const blocker = new Client(getPostgresConnectionConfig());
    let update: ReturnType<typeof routerClient.flights.update> | undefined;

    await blocker.connect();
    try {
      await blocker.query("BEGIN");
      const blockerPidResult = await blocker.query<{ pid: number }>(
        "SELECT pg_backend_pid() AS pid",
      );
      const blockerPid = blockerPidResult.rows[0]?.pid;
      if (!blockerPid) throw new Error("Unable to load flight blocker pid");
      await blocker.query("SELECT id FROM flight WHERE id = $1 FOR UPDATE", [
        flight.id,
      ]);

      update = routerClient.flights.update(
        { flight: flight.publicId, name: "Stale authorization" },
        { context: { user: owner } },
      );
      void update.catch(() => undefined);
      await waitForSessionsBlockedBy(blocker, blockerPid, 1);

      await blocker.query(
        "UPDATE flight SET created_by_id = $2 WHERE id = $1",
        [flight.id, newOwner.id],
      );
      await blocker.query("COMMIT");

      const error = await waitError(update);
      expect(error).toMatchInlineSnapshot(`[Error: Failed to update flight.]`);
    } finally {
      await blocker.query("ROLLBACK").catch(() => undefined);
      await blocker.end();
      if (update) await update.catch(() => undefined);
    }

    const persistedFlight = await db.query.flights.findFirst({
      where: eq(flights.id, flight.id),
    });
    expect(persistedFlight).toMatchObject({
      name: flight.name,
      createdById: newOwner.id,
    });
  }, 30_000);

  test("can change bottles", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const bottle1 = await fixtures.Bottle({ name: "Bottle 1" });
    const bottle2 = await fixtures.Bottle({ name: "Bottle 2" });
    const bottle3 = await fixtures.Bottle({ name: "Bottle 3" });
    const flight = await fixtures.Flight({ bottles: [bottle1.id, bottle2.id] });

    const data = await routerClient.flights.update(
      {
        flight: flight.publicId,
        bottles: [bottle1.id, bottle3.id],
      },
      { context: { user } },
    );

    expect(data.id).toBeDefined();

    const [newFlight] = await db
      .select()
      .from(flights)
      .where(eq(flights.publicId, data.id));

    expect(flight).toEqual(newFlight);

    const bottles = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, newFlight.id));
    expect(bottles.length).toEqual(2);

    expect(bottles.map((fb) => fb.bottleId).sort()).toEqual([
      bottle1.id,
      bottle3.id,
    ]);
    expect(bottles.every((membership) => membership.releaseId === null)).toBe(
      true,
    );

    const targetIds = await db
      .select({ id: catalogTargets.id })
      .from(catalogTargets)
      .where(eq(catalogTargets.bottleId, bottle1.id));
    const target3Ids = await db
      .select({ id: catalogTargets.id })
      .from(catalogTargets)
      .where(eq(catalogTargets.bottleId, bottle3.id));
    expect(bottles.map((membership) => membership.targetId).sort()).toEqual(
      [...targetIds, ...target3Ids].map((target) => target.id).sort(),
    );
  });

  test("stores a generic target for submitted parents with releases", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: bottle.id });
    const flight = await fixtures.Flight();
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, bottle.groupId as number),
        isNull(catalogTargets.bottleId),
      ),
    });
    if (!genericTarget) throw new Error("Generic target fixture not found");

    await routerClient.flights.update(
      { flight: flight.publicId, bottles: [bottle.id] },
      { context: { user } },
    );

    const memberships = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(memberships).toEqual([
      {
        flightId: flight.id,
        bottleId: bottle.id,
        releaseId: null,
        targetId: genericTarget.id,
      },
    ]);
  });

  test("canonicalizes submissions resolving to the same generic target", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const parent = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: parent.id });
    if (parent.groupId === null)
      throw new Error("Bottle group fixture missing");
    const [sibling] = await db
      .insert(bottleTable)
      .values({
        groupId: parent.groupId,
        brandId: parent.brandId,
        createdByActorId: parent.createdByActorId,
        name: "Sibling parent",
        fullName: "Sibling parent",
      })
      .returning();
    if (!sibling) throw new Error("Sibling Bottle fixture not found");
    await db.insert(catalogTargets).values({
      groupId: parent.groupId,
      bottleId: sibling.id,
    });
    await fixtures.BottleRelease({ bottleId: sibling.id });
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, parent.groupId),
        isNull(catalogTargets.bottleId),
      ),
    });
    if (!genericTarget) throw new Error("Generic target fixture not found");
    const flight = await fixtures.Flight();

    await routerClient.flights.update(
      {
        flight: flight.publicId,
        bottles: [sibling.id, parent.id, sibling.id],
      },
      { context: { user } },
    );

    const memberships = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(memberships).toEqual([
      {
        flightId: flight.id,
        bottleId: Math.min(parent.id, sibling.id),
        releaseId: null,
        targetId: genericTarget.id,
      },
    ]);
  });

  test("deduplicates the exact bottle replacement set", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle1 = await fixtures.Bottle({ name: "Bottle 1" });
    const bottle2 = await fixtures.Bottle({ name: "Bottle 2" });
    const flight = await fixtures.Flight();

    await routerClient.flights.update(
      {
        flight: flight.publicId,
        bottles: [bottle2.id, bottle1.id, bottle2.id, bottle1.id],
      },
      { context: { user } },
    );

    const memberships = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(memberships).toHaveLength(2);
    expect(memberships.map(({ bottleId }) => bottleId).sort()).toEqual(
      [bottle1.id, bottle2.id].sort(),
    );
    expect(memberships.every(({ targetId }) => targetId !== null)).toBe(true);
  });

  test("replaces targetless and stale retained memberships", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const selected1 = await fixtures.Bottle({ name: "Selected 1" });
    const selected2 = await fixtures.Bottle({ name: "Selected 2" });
    const staleRetained = await fixtures.Bottle({ name: "Stale retained" });
    const targetless = await fixtures.Bottle({ name: "Targetless" });
    const flight = await fixtures.Flight();
    const selected1Target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, selected1.id),
    });
    if (!selected1Target) throw new Error("Exact target fixture not found");

    await db.insert(flightBottles).values([
      {
        flightId: flight.id,
        bottleId: staleRetained.id,
        releaseId: null,
        targetId: selected1Target.id,
      },
      {
        flightId: flight.id,
        bottleId: targetless.id,
        releaseId: null,
        targetId: null,
      },
    ]);

    await routerClient.flights.update(
      {
        flight: flight.publicId,
        bottles: [selected1.id, selected2.id],
      },
      { context: { user } },
    );

    const memberships = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(memberships).toHaveLength(2);
    expect(memberships.map(({ bottleId }) => bottleId).sort()).toEqual(
      [selected1.id, selected2.id].sort(),
    );
    expect(memberships.every(({ targetId }) => targetId !== null)).toBe(true);
  });

  test("an empty bottle list clears every membership", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const flight = await fixtures.Flight({ bottles: [bottle.id] });

    await routerClient.flights.update(
      { flight: flight.publicId, bottles: [] },
      { context: { user } },
    );

    const memberships = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(memberships).toHaveLength(0);
  });

  test("invalid targets roll back flight metadata and memberships", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const flight = await fixtures.Flight({ bottles: [bottle.id] });

    await waitError(() =>
      routerClient.flights.update(
        {
          flight: flight.publicId,
          name: "Should not persist",
          bottles: [Number.MAX_SAFE_INTEGER],
        },
        { context: { user } },
      ),
    );

    const persistedFlight = await db.query.flights.findFirst({
      where: eq(flights.id, flight.id),
    });
    const memberships = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(persistedFlight?.name).toBe(flight.name);
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(memberships[0]?.targetId).not.toBeNull();
  });

  test("retired existing targets cannot be silently replaced", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const retiredBottle = await fixtures.Bottle();
    const replacementBottle = await fixtures.Bottle();
    const flight = await fixtures.Flight({ bottles: [retiredBottle.id] });
    const before = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: replacementBottle.id,
    });

    await waitError(() =>
      routerClient.flights.update(
        {
          flight: flight.publicId,
          name: "Should not persist",
          bottles: [replacementBottle.id],
        },
        { context: { user } },
      ),
    );

    const persistedFlight = await db.query.flights.findFirst({
      where: eq(flights.id, flight.id),
    });
    const memberships = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(persistedFlight?.name).toBe(flight.name);
    expect(memberships).toEqual(before);
  });

  test("retries when a merge retires the snapshotted membership target", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const sourceBottle = await fixtures.Bottle();
    const mergeDestination = await fixtures.Bottle();
    const replacementBottle = await fixtures.Bottle();
    const flight = await fixtures.Flight({ bottles: [sourceBottle.id] });
    const sourceTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, sourceBottle.id),
    });
    const mergeDestinationTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, mergeDestination.id),
    });
    const replacementTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, replacementBottle.id),
    });
    if (!sourceTarget || !mergeDestinationTarget || !replacementTarget) {
      throw new Error("Exact target fixtures not found");
    }

    const membershipBlocker = new Client(getPostgresConnectionConfig());
    const newTargetBlocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let update: ReturnType<typeof routerClient.flights.update> | undefined;
    let destinationTargetLock: Promise<unknown> | undefined;
    await membershipBlocker.connect();
    await newTargetBlocker.connect();
    await observer.connect();
    try {
      await membershipBlocker.query("BEGIN");
      const membershipBlockerPidResult = await membershipBlocker.query<{
        pid: number;
      }>("SELECT pg_backend_pid() AS pid");
      const membershipBlockerPid = membershipBlockerPidResult.rows[0]?.pid;
      if (!membershipBlockerPid) {
        throw new Error("Unable to load membership blocker pid");
      }
      await membershipBlocker.query(
        `SELECT id
         FROM bottle_group
         WHERE id = ANY($1::bigint[])
         ORDER BY id
         FOR UPDATE`,
        [[sourceTarget.groupId, mergeDestinationTarget.groupId]],
      );
      await membershipBlocker.query(
        `SELECT id
         FROM bottle
         WHERE id = ANY($1::bigint[])
         ORDER BY id
         FOR UPDATE`,
        [[sourceBottle.id, mergeDestination.id]],
      );
      await membershipBlocker.query(
        `SELECT id
         FROM catalog_target
         WHERE id = ANY($1::bigint[])
         ORDER BY id
         FOR UPDATE`,
        [[sourceTarget.id, mergeDestinationTarget.id]],
      );
      await membershipBlocker.query(
        `SELECT flight_id
         FROM flight_bottle
         WHERE flight_id = $1
         FOR UPDATE`,
        [flight.id],
      );

      await newTargetBlocker.query("BEGIN");
      const newTargetBlockerPidResult = await newTargetBlocker.query<{
        pid: number;
      }>("SELECT pg_backend_pid() AS pid");
      const newTargetBlockerPid = newTargetBlockerPidResult.rows[0]?.pid;
      if (!newTargetBlockerPid) {
        throw new Error("Unable to load target blocker pid");
      }
      destinationTargetLock = newTargetBlocker.query(
        "SELECT id FROM catalog_target WHERE id = $1 FOR UPDATE",
        [mergeDestinationTarget.id],
      );
      void destinationTargetLock.catch(() => undefined);

      update = routerClient.flights.update(
        {
          flight: flight.publicId,
          name: "Updated after merge retry",
          bottles: [replacementBottle.id],
        },
        { context: { user } },
      );
      void update.catch(() => undefined);
      await waitForSessionsBlockedBy(
        membershipBlocker,
        membershipBlockerPid,
        2,
      );

      await observer.query("BEGIN");
      await expect(
        observer.query(
          "SELECT id FROM flight WHERE id = $1 FOR UPDATE NOWAIT",
          [flight.id],
        ),
      ).resolves.toBeDefined();
      await observer.query("ROLLBACK");

      await membershipBlocker.query(
        `UPDATE flight_bottle
         SET bottle_id = $2, target_id = $3
         WHERE flight_id = $1 AND target_id = $4`,
        [
          flight.id,
          mergeDestination.id,
          mergeDestinationTarget.id,
          sourceTarget.id,
        ],
      );
      await membershipBlocker.query(
        `INSERT INTO bottle_tombstone (bottle_id, new_bottle_id)
         VALUES ($1, $2)`,
        [sourceBottle.id, mergeDestination.id],
      );
      await membershipBlocker.query("COMMIT");
      await destinationTargetLock;
      await waitForSessionsBlockedBy(newTargetBlocker, newTargetBlockerPid, 1);

      await observer.query("BEGIN");
      await expect(
        observer.query(
          "SELECT id FROM flight WHERE id = $1 FOR UPDATE NOWAIT",
          [flight.id],
        ),
      ).resolves.toBeDefined();
      await observer.query("ROLLBACK");
      const unchangedDuringRetry = await observer.query<{ name: string }>(
        "SELECT name FROM flight WHERE id = $1",
        [flight.id],
      );
      expect(unchangedDuringRetry.rows[0]?.name).toBe(flight.name);

      await newTargetBlocker.query("COMMIT");
      await update;
    } finally {
      await membershipBlocker.query("ROLLBACK").catch(() => undefined);
      await newTargetBlocker.query("ROLLBACK").catch(() => undefined);
      await membershipBlocker.end();
      await newTargetBlocker.end();
      await observer.end();
      if (update) await update.catch(() => undefined);
      if (destinationTargetLock) {
        await destinationTargetLock.catch(() => undefined);
      }
    }

    const persistedFlight = await db.query.flights.findFirst({
      where: eq(flights.id, flight.id),
    });
    const memberships = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(persistedFlight?.name).toBe("Updated after merge retry");
    expect(memberships).toEqual([
      {
        flightId: flight.id,
        bottleId: replacementBottle.id,
        releaseId: null,
        targetId: replacementTarget.id,
      },
    ]);
  }, 30_000);

  test("retries changed membership snapshots after locking existing targets", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const existingBottle = await fixtures.Bottle();
    const replacementBottle = await fixtures.Bottle();
    const concurrentBottle = await fixtures.Bottle();
    const flight = await fixtures.Flight({ bottles: [existingBottle.id] });
    const existingTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, existingBottle.id),
    });
    const replacementTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, replacementBottle.id),
    });
    const concurrentTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, concurrentBottle.id),
    });
    if (!existingTarget || !replacementTarget || !concurrentTarget) {
      throw new Error("Exact target fixtures not found");
    }

    const initialTargetBlocker = new Client(getPostgresConnectionConfig());
    const newTargetBlocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let update: ReturnType<typeof routerClient.flights.update> | undefined;
    await initialTargetBlocker.connect();
    await newTargetBlocker.connect();
    await observer.connect();
    try {
      await initialTargetBlocker.query("BEGIN");
      const initialBlockerPidResult = await initialTargetBlocker.query<{
        pid: number;
      }>("SELECT pg_backend_pid() AS pid");
      const initialBlockerPid = initialBlockerPidResult.rows[0]?.pid;
      if (!initialBlockerPid) throw new Error("Unable to load blocker pid");
      await initialTargetBlocker.query(
        "SELECT id FROM catalog_target WHERE id = $1 FOR UPDATE",
        [existingTarget.id],
      );

      update = routerClient.flights.update(
        {
          flight: flight.publicId,
          name: "Updated after target lock",
          bottles: [replacementBottle.id],
        },
        { context: { user } },
      );
      void update.catch(() => undefined);
      await waitForSessionsBlockedBy(
        initialTargetBlocker,
        initialBlockerPid,
        1,
      );

      await observer.query("BEGIN");
      await expect(
        observer.query(
          "SELECT id FROM flight WHERE id = $1 FOR UPDATE NOWAIT",
          [flight.id],
        ),
      ).resolves.toBeDefined();
      await observer.query("ROLLBACK");

      const stillUnchanged = await observer.query<{ name: string }>(
        "SELECT name FROM flight WHERE id = $1",
        [flight.id],
      );
      expect(stillUnchanged.rows[0]?.name).toBe(flight.name);
      await newTargetBlocker.query(
        `INSERT INTO flight_bottle
           (flight_id, bottle_id, release_id, target_id)
         VALUES ($1, $2, NULL, $3)`,
        [flight.id, concurrentBottle.id, concurrentTarget.id],
      );
      await newTargetBlocker.query("BEGIN");
      const newBlockerPidResult = await newTargetBlocker.query<{ pid: number }>(
        "SELECT pg_backend_pid() AS pid",
      );
      const newBlockerPid = newBlockerPidResult.rows[0]?.pid;
      if (!newBlockerPid) throw new Error("Unable to load blocker pid");
      await newTargetBlocker.query(
        "SELECT id FROM catalog_target WHERE id = $1 FOR UPDATE",
        [concurrentTarget.id],
      );

      await initialTargetBlocker.query("COMMIT");
      await waitForSessionsBlockedBy(newTargetBlocker, newBlockerPid, 1);

      await observer.query("BEGIN");
      await expect(
        observer.query(
          "SELECT id FROM flight WHERE id = $1 FOR UPDATE NOWAIT",
          [flight.id],
        ),
      ).resolves.toBeDefined();
      await observer.query("ROLLBACK");

      const unchangedDuringRetry = await observer.query<{ name: string }>(
        "SELECT name FROM flight WHERE id = $1",
        [flight.id],
      );
      expect(unchangedDuringRetry.rows[0]?.name).toBe(flight.name);

      await newTargetBlocker.query("COMMIT");
      await update;
    } finally {
      await initialTargetBlocker.query("ROLLBACK").catch(() => undefined);
      await newTargetBlocker.query("ROLLBACK").catch(() => undefined);
      await initialTargetBlocker.end();
      await newTargetBlocker.end();
      await observer.end();
      if (update) await update.catch(() => undefined);
    }

    const persistedFlight = await db.query.flights.findFirst({
      where: eq(flights.id, flight.id),
    });
    const memberships = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(persistedFlight?.name).toBe("Updated after target lock");
    expect(memberships).toEqual([
      {
        flightId: flight.id,
        bottleId: replacementBottle.id,
        releaseId: null,
        targetId: replacementTarget.id,
      },
    ]);
  }, 30_000);
});
