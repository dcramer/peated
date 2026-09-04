import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import {
  bottleTombstones,
  bottlesToDistillers,
  entities,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import pg from "pg";
import {
  checkEntityBottleCounts,
  getBottleEntityLinks,
  repairEntityBottleCount,
  updateEntityBottleCounts,
} from "./entityBottleCounts";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

async function waitForSessionBlockedBy(
  observer: NodePgClient,
  blockerPid: number,
): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const result = await observer.query<{ pid: number }>(
      `SELECT pid
       FROM pg_stat_activity
       WHERE $1 = ANY(pg_blocking_pids(pid))
       LIMIT 1`,
      [blockerPid],
    );
    if (result.rows.length) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for the Entity repair lock.");
}

describe("Entity Bottle counts", () => {
  test("counts one Bottle once when an Entity fills every role", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ totalBottles: 0 });
    const bottle = await fixtures.Bottle({
      brandId: entity.id,
      bottlerId: entity.id,
      distillerIds: [entity.id],
    });
    await db
      .update(entities)
      .set({ totalBottles: 0 })
      .where(eq(entities.id, entity.id));

    await db.transaction(async (tx) => {
      const after = await getBottleEntityLinks(tx, [bottle.id]);
      await updateEntityBottleCounts(tx, [], after);
    });

    await expect(
      db.query.entities.findFirst({ where: eq(entities.id, entity.id) }),
    ).resolves.toMatchObject({ totalBottles: 1 });
    await expect(checkEntityBottleCounts([entity.id])).resolves.toEqual([]);
  });

  test("updates only Entities whose Bottle links change", async ({
    fixtures,
  }) => {
    const retained = await fixtures.Entity({ totalBottles: 1 });
    const removed = await fixtures.Entity({ totalBottles: 1 });
    const added = await fixtures.Entity({ totalBottles: 0 });
    const bottle = await fixtures.Bottle({
      brandId: retained.id,
      distillerIds: [removed.id],
    });
    await db
      .update(entities)
      .set({ totalBottles: 1 })
      .where(eq(entities.id, retained.id));
    await db
      .update(entities)
      .set({ totalBottles: 1 })
      .where(eq(entities.id, removed.id));
    await db
      .update(entities)
      .set({ totalBottles: 0 })
      .where(eq(entities.id, added.id));

    await db.transaction(async (tx) => {
      const before = await getBottleEntityLinks(tx, [bottle.id]);
      await tx
        .delete(bottlesToDistillers)
        .where(eq(bottlesToDistillers.bottleId, bottle.id));
      await tx.insert(bottlesToDistillers).values({
        bottleId: bottle.id,
        distillerId: added.id,
      });
      const after = await getBottleEntityLinks(tx, [bottle.id]);
      await updateEntityBottleCounts(tx, before, after);
    });

    const rows = await db
      .select({ id: entities.id, totalBottles: entities.totalBottles })
      .from(entities)
      .where(eq(entities.id, retained.id));
    expect(rows).toEqual([{ id: retained.id, totalBottles: 1 }]);
    await expect(
      db.query.entities.findFirst({ where: eq(entities.id, removed.id) }),
    ).resolves.toMatchObject({ totalBottles: 0 });
    await expect(
      db.query.entities.findFirst({ where: eq(entities.id, added.id) }),
    ).resolves.toMatchObject({ totalBottles: 1 });
  });

  test("repairs an old undercount when removing a Bottle link", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ totalBottles: 0 });
    const removedBottle = await fixtures.Bottle({ brandId: entity.id });
    await fixtures.Bottle({ brandId: entity.id });
    await db
      .update(entities)
      .set({ totalBottles: 0 })
      .where(eq(entities.id, entity.id));

    await db.transaction(async (tx) => {
      const before = await getBottleEntityLinks(tx, [removedBottle.id]);
      await tx.insert(bottleTombstones).values({ bottleId: removedBottle.id });
      const after = await getBottleEntityLinks(tx, [removedBottle.id]);
      await updateEntityBottleCounts(tx, before, after);
    });

    await expect(
      db.query.entities.findFirst({ where: eq(entities.id, entity.id) }),
    ).resolves.toMatchObject({ totalBottles: 1 });
    await expect(checkEntityBottleCounts([entity.id])).resolves.toEqual([]);
  });

  test("rolls back earlier changes when an Entity is missing", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ totalBottles: 0 });
    const missingEntityId = 2_147_483_647;

    await expect(
      db.transaction((tx) =>
        updateEntityBottleCounts(
          tx,
          [],
          [{ bottleId: 10, entityIds: [entity.id, missingEntityId] }],
        ),
      ),
    ).rejects.toThrow(
      `Cannot update Bottle count: Entity ${missingEntityId} is missing.`,
    );
    await expect(
      db.query.entities.findFirst({ where: eq(entities.id, entity.id) }),
    ).resolves.toMatchObject({ totalBottles: 0 });
  });

  test("counts two Bottles saved at the same time", async ({ fixtures }) => {
    const entity = await fixtures.Entity({ totalBottles: 0 });
    const first = await fixtures.Bottle({ brandId: entity.id });
    const second = await fixtures.Bottle({ brandId: entity.id });
    await db
      .update(entities)
      .set({ totalBottles: 0 })
      .where(eq(entities.id, entity.id));

    await Promise.all(
      [first.id, second.id].map((bottleId) =>
        db.transaction(async (tx) => {
          const after = await getBottleEntityLinks(tx, [bottleId]);
          await updateEntityBottleCounts(tx, [], after);
        }),
      ),
    );

    await expect(
      db.query.entities.findFirst({ where: eq(entities.id, entity.id) }),
    ).resolves.toMatchObject({ totalBottles: 2 });
  });

  test("finds and repairs wrong saved counts", async ({ fixtures }) => {
    const wrong = await fixtures.Entity({ totalBottles: 8 });
    const correctZero = await fixtures.Entity({ totalBottles: 0 });
    await fixtures.Bottle({ brandId: wrong.id });
    await db
      .update(entities)
      .set({ totalBottles: 8 })
      .where(eq(entities.id, wrong.id));

    await expect(
      checkEntityBottleCounts([wrong.id, correctZero.id]),
    ).resolves.toEqual([{ entityId: wrong.id, savedCount: 8, actualCount: 1 }]);
    await expect(checkEntityBottleCounts([])).resolves.toEqual([]);

    await expect(repairEntityBottleCount(wrong.id)).resolves.toEqual({
      entityId: wrong.id,
      savedCount: 8,
      actualCount: 1,
    });
    await expect(
      checkEntityBottleCounts([wrong.id, correctZero.id]),
    ).resolves.toEqual([]);
  });

  test("recounts after an earlier Bottle change commits", async ({
    fixtures,
  }) => {
    const target = await fixtures.Entity();
    const source = await fixtures.Entity();
    await fixtures.Bottle({ brandId: target.id });
    const movingBottle = await fixtures.Bottle({ brandId: source.id });
    await db
      .update(entities)
      .set({ totalBottles: 0 })
      .where(eq(entities.id, target.id));

    const writer = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let writerCommitted = false;
    let repair: ReturnType<typeof repairEntityBottleCount> | null = null;

    await writer.connect();
    await observer.connect();
    try {
      await writer.query("BEGIN");
      const writerPid = (
        await writer.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!writerPid) throw new Error("Unable to load Bottle writer pid.");

      await writer.query("SELECT id FROM entity WHERE id = $1 FOR UPDATE", [
        target.id,
      ]);
      await writer.query("UPDATE bottle SET brand_id = $2 WHERE id = $1", [
        movingBottle.id,
        target.id,
      ]);
      await writer.query(
        "UPDATE entity SET total_bottles = total_bottles + 1 WHERE id = $1",
        [target.id],
      );

      repair = repairEntityBottleCount(target.id);
      void repair.catch(() => undefined);
      await waitForSessionBlockedBy(observer, writerPid);

      await writer.query("COMMIT");
      writerCommitted = true;

      await expect(repair).resolves.toEqual({
        entityId: target.id,
        savedCount: 1,
        actualCount: 2,
      });
    } finally {
      if (!writerCommitted) {
        await writer.query("ROLLBACK").catch(() => undefined);
      }
      if (repair) await repair.catch(() => undefined);
      await writer.end();
      await observer.end();
    }

    await expect(
      db.query.entities.findFirst({ where: eq(entities.id, target.id) }),
    ).resolves.toMatchObject({ totalBottles: 2 });
  });
});
