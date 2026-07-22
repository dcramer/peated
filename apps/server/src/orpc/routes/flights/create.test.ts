import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import {
  bottles,
  catalogTargets,
  flightBottles,
  flights,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, inArray, isNull } from "drizzle-orm";
import pg from "pg";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

async function waitForSessionBlockedBy(
  observer: NodePgClient,
  blockerPid: number,
): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await observer.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM pg_stat_activity
       WHERE $1 = ANY(pg_blocking_pids(pid))`,
      [blockerPid],
    );
    if ((result.rows[0]?.count ?? 0) >= 1) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for Flight target lock.");
}

describe("POST /flights", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.flights.create({
        name: "Delicious Wood",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("creates a new flight", async ({ fixtures }) => {
    const user = await fixtures.User();
    const data = await routerClient.flights.create(
      {
        name: "Macallan",
      },
      { context: { user } },
    );

    expect(data.id).toBeDefined();

    const [flight] = await db
      .select()
      .from(flights)
      .where(eq(flights.publicId, data.id));
    expect(flight.name).toEqual("Macallan");
  });

  test("stores exact targets for every selected Bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const firstBottle = await fixtures.Bottle();
    const secondBottle = await fixtures.Bottle();

    const data = await routerClient.flights.create(
      {
        name: "Exact flight",
        bottles: [secondBottle.id, firstBottle.id],
      },
      { context: { user } },
    );

    const flight = await db.query.flights.findFirst({
      where: eq(flights.publicId, data.id),
    });
    if (!flight) throw new Error("Flight fixture not found");

    const memberships = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    const targets = await db
      .select()
      .from(catalogTargets)
      .where(
        inArray(catalogTargets.bottleId, [firstBottle.id, secondBottle.id]),
      );

    expect(memberships).toHaveLength(2);
    expect(
      memberships
        .map(({ targetId, bottleId, releaseId }) => ({
          targetId,
          bottleId,
          releaseId,
        }))
        .sort((a, b) => (a.bottleId ?? 0) - (b.bottleId ?? 0)),
    ).toEqual(
      targets
        .map(({ id, bottleId }) => ({
          targetId: id,
          bottleId,
          releaseId: null,
        }))
        .sort((a, b) => (a.bottleId ?? 0) - (b.bottleId ?? 0)),
    );
  });

  test("stores target-native exact and generic memberships", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const exactBottle = await fixtures.Bottle();
    const genericBottle = await fixtures.Bottle();
    if (genericBottle.groupId === null) {
      throw new Error("Bottle group fixture not found");
    }
    const [exactTarget, genericTarget] = await Promise.all([
      db.query.catalogTargets.findFirst({
        where: eq(catalogTargets.bottleId, exactBottle.id),
      }),
      db.query.catalogTargets.findFirst({
        where: and(
          eq(catalogTargets.groupId, genericBottle.groupId),
          isNull(catalogTargets.bottleId),
        ),
      }),
    ]);
    if (!exactTarget || !genericTarget) throw new Error("Missing targets");

    const data = await routerClient.flights.create(
      { name: "Target flight", targets: [genericTarget.id, exactTarget.id] },
      { context: { user } },
    );
    const flight = await db.query.flights.findFirst({
      where: eq(flights.publicId, data.id),
    });
    if (!flight) throw new Error("Missing flight");
    const memberships = await db.query.flightBottles.findMany({
      where: eq(flightBottles.flightId, flight.id),
    });

    expect(memberships).toHaveLength(2);
    expect(
      memberships
        .map(({ flightId, targetId, bottleId, releaseId }) => ({
          flightId,
          targetId,
          bottleId,
          releaseId,
        }))
        .sort((left, right) => (left.targetId ?? 0) - (right.targetId ?? 0)),
    ).toEqual(
      [
        {
          flightId: flight.id,
          targetId: exactTarget.id,
          bottleId: exactBottle.id,
          releaseId: null,
        },
        {
          flightId: flight.id,
          targetId: genericTarget.id,
          bottleId: null,
          releaseId: null,
        },
      ].sort((left, right) => left.targetId - right.targetId),
    );
  });

  test("rejects mixed target and retained membership input", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    if (!target) throw new Error("Missing target");

    const error = await waitError(() =>
      routerClient.flights.create(
        {
          name: "Invalid mixed flight",
          targets: [target.id],
          bottles: [bottle.id],
        } as never,
        { context: { user } },
      ),
    );
    expect(error).toMatchObject({ message: "Input validation failed" });
  });

  test("locks every selected target before inserting the Flight", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const firstBottle = await fixtures.Bottle();
    const secondBottle = await fixtures.Bottle();
    const targets = await db
      .select()
      .from(catalogTargets)
      .where(
        inArray(catalogTargets.bottleId, [firstBottle.id, secondBottle.id]),
      );
    const blockedTarget = targets.toSorted((a, b) => a.id - b.id).at(-1);
    if (!blockedTarget || targets.length !== 2) {
      throw new Error("Exact target fixtures not found");
    }

    const blocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    const flightName = "Target-locked flight";
    let creation: ReturnType<typeof routerClient.flights.create> | undefined;
    let blockerReleased = false;

    await blocker.connect();
    await observer.connect();
    try {
      const sequenceBefore = await observer.query<{
        is_called: boolean;
        last_value: string;
      }>("SELECT last_value::text, is_called FROM flight_id_seq");
      await blocker.query("BEGIN");
      const blockerPid = (
        await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!blockerPid) throw new Error("Unable to load blocker pid");
      await blocker.query(
        "SELECT id FROM catalog_target WHERE id = $1 FOR UPDATE",
        [blockedTarget.id],
      );

      creation = routerClient.flights.create(
        {
          name: flightName,
          bottles: [secondBottle.id, firstBottle.id],
        },
        { context: { user } },
      );
      void creation.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);

      const blockedFlight = await observer.query<{ id: string }>(
        "SELECT id FROM flight WHERE name = $1",
        [flightName],
      );
      expect(blockedFlight.rows).toHaveLength(0);
      expect(
        (
          await observer.query<{ is_called: boolean; last_value: string }>(
            "SELECT last_value::text, is_called FROM flight_id_seq",
          )
        ).rows,
      ).toEqual(sequenceBefore.rows);

      await blocker.query("COMMIT");
      blockerReleased = true;
      const result = await creation;
      const flight = await db.query.flights.findFirst({
        where: eq(flights.publicId, result.id),
      });
      if (!flight) throw new Error("Created Flight not found");

      const memberships = await db
        .select()
        .from(flightBottles)
        .where(eq(flightBottles.flightId, flight.id));
      expect(
        memberships
          .map(({ bottleId, releaseId, targetId }) => ({
            bottleId,
            releaseId,
            targetId,
          }))
          .sort((a, b) => (a.bottleId ?? 0) - (b.bottleId ?? 0)),
      ).toEqual(
        targets
          .map(({ bottleId, id }) => ({
            bottleId,
            releaseId: null,
            targetId: id,
          }))
          .sort((a, b) => (a.bottleId ?? 0) - (b.bottleId ?? 0)),
      );
    } finally {
      if (!blockerReleased) {
        await blocker.query("ROLLBACK").catch(() => undefined);
      }
      await blocker.end();
      await observer.end();
      if (creation) await creation.catch(() => undefined);
    }
  }, 30_000);

  test("deduplicates repeated Bottle selections", async ({ fixtures }) => {
    const user = await fixtures.User();
    const bottle = await fixtures.Bottle();

    const data = await routerClient.flights.create(
      {
        name: "One pour",
        bottles: [bottle.id, bottle.id, bottle.id],
      },
      { context: { user } },
    );

    const flight = await db.query.flights.findFirst({
      where: eq(flights.publicId, data.id),
    });
    if (!flight) throw new Error("Flight fixture not found");

    const memberships = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      bottleId: bottle.id,
      releaseId: null,
    });
    expect(memberships[0]?.targetId).not.toBeNull();
  });

  test("collapses shared generic intent and retains the lowest submitted Bottle ID", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const firstBottle = await fixtures.Bottle();
    if (firstBottle.groupId === null) {
      throw new Error("BottleGroup fixture not found");
    }
    const [secondBottle] = await db
      .insert(bottles)
      .values({
        groupId: firstBottle.groupId,
        brandId: firstBottle.brandId,
        createdByActorId: firstBottle.createdByActorId,
        name: "Second grouped Bottle",
        fullName: "Second grouped Bottle",
      })
      .returning();
    if (!secondBottle) throw new Error("Second Bottle fixture not found");
    await db.insert(catalogTargets).values({
      groupId: firstBottle.groupId,
      bottleId: secondBottle.id,
    });
    await fixtures.BottleRelease({ bottleId: firstBottle.id });
    await fixtures.BottleRelease({ bottleId: secondBottle.id });

    const data = await routerClient.flights.create(
      {
        name: "Shared expression flight",
        bottles: [secondBottle.id, firstBottle.id],
      },
      { context: { user } },
    );

    const flight = await db.query.flights.findFirst({
      where: eq(flights.publicId, data.id),
    });
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, firstBottle.groupId),
        isNull(catalogTargets.bottleId),
      ),
    });
    if (!flight || !genericTarget) {
      throw new Error("Flight target fixture not found");
    }
    const memberships = await db
      .select()
      .from(flightBottles)
      .where(eq(flightBottles.flightId, flight.id));

    expect(memberships).toEqual([
      {
        flightId: flight.id,
        targetId: genericTarget.id,
        bottleId: Math.min(firstBottle.id, secondBottle.id),
        releaseId: null,
      },
    ]);
  });

  test("rolls back the entire flight when a selected Bottle has no valid target", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const legacyBottle = await fixtures.LegacyBottle();

    const err = await waitError(() =>
      routerClient.flights.create(
        {
          name: "Invalid target flight",
          bottles: [bottle.id, legacyBottle.id],
        },
        { context: { user } },
      ),
    );

    expect(err.message).toContain("Legacy catalog target mapping is invalid");
    const storedFlight = await db.query.flights.findFirst({
      where: eq(flights.name, "Invalid target flight"),
    });
    expect(storedFlight).toBeUndefined();
  });

  test("does not create a flight for a missing Bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();

    const err = await waitError(() =>
      routerClient.flights.create(
        {
          name: "Missing Bottle flight",
          bottles: [Number.MAX_SAFE_INTEGER],
        },
        { context: { user } },
      ),
    );

    expect(err.message).toContain("Catalog target not found");
    const storedFlight = await db.query.flights.findFirst({
      where: eq(flights.name, "Missing Bottle flight"),
    });
    expect(storedFlight).toBeUndefined();
  });

  test("returns conflict and rolls back for an invalid target id", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();

    const error = await waitError(() =>
      routerClient.flights.create(
        {
          name: "Missing target flight",
          targets: [Number.MAX_SAFE_INTEGER],
        },
        { context: { user } },
      ),
    );

    expect(error).toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("Catalog target not found"),
    });
    await expect(
      db.query.flights.findFirst({
        where: eq(flights.name, "Missing target flight"),
      }),
    ).resolves.toBeUndefined();
  });
});
