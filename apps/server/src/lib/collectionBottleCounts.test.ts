import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import { collectionBottles, collections } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import pg from "pg";
import {
  checkCollectionBottleCounts,
  repairCollectionBottleCount,
  updateCollectionBottleCounts,
} from "./collectionBottleCounts";

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
  throw new Error("Timed out waiting for the Collection repair lock.");
}

describe("Collection Bottle counts", () => {
  test("counts a membership added in the same transaction", async ({
    defaults,
    fixtures,
  }) => {
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 0,
    });
    const bottle = await fixtures.Bottle();

    await db.transaction(async (tx) => {
      await tx.insert(collectionBottles).values({
        collectionId: collection.id,
        bottleId: bottle.id,
      });
      await updateCollectionBottleCounts(tx, [], [collection.id]);
    });

    await expect(
      db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      }),
    ).resolves.toMatchObject({ totalBottles: 1 });
    await expect(checkCollectionBottleCounts([collection.id])).resolves.toEqual(
      [],
    );
  });

  test("repairs an old undercount when removing a membership", async ({
    defaults,
    fixtures,
  }) => {
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 0,
    });
    const removedBottle = await fixtures.Bottle();
    const retainedBottle = await fixtures.Bottle();
    await db.insert(collectionBottles).values([
      { collectionId: collection.id, bottleId: removedBottle.id },
      { collectionId: collection.id, bottleId: retainedBottle.id },
    ]);

    await db.transaction(async (tx) => {
      await tx
        .delete(collectionBottles)
        .where(eq(collectionBottles.bottleId, removedBottle.id));
      await updateCollectionBottleCounts(tx, [collection.id], []);
    });

    await expect(
      db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      }),
    ).resolves.toMatchObject({ totalBottles: 1 });
    await expect(checkCollectionBottleCounts([collection.id])).resolves.toEqual(
      [],
    );
  });

  test("rolls back earlier changes when a Collection is missing", async ({
    defaults,
    fixtures,
  }) => {
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 0,
    });
    const missingCollectionId = 2_147_483_647;

    await expect(
      db.transaction((tx) =>
        updateCollectionBottleCounts(
          tx,
          [],
          [collection.id, missingCollectionId],
        ),
      ),
    ).rejects.toThrow(
      `Cannot update Bottle count: Collection ${missingCollectionId} is missing.`,
    );
    await expect(
      db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      }),
    ).resolves.toMatchObject({ totalBottles: 0 });
  });

  test("counts memberships saved at the same time", async ({
    defaults,
    fixtures,
  }) => {
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 0,
    });
    const bottles = await Promise.all([fixtures.Bottle(), fixtures.Bottle()]);

    await Promise.all(
      bottles.map((bottle) =>
        db.transaction(async (tx) => {
          await tx.insert(collectionBottles).values({
            collectionId: collection.id,
            bottleId: bottle.id,
          });
          await updateCollectionBottleCounts(tx, [], [collection.id]);
        }),
      ),
    );

    await expect(
      db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      }),
    ).resolves.toMatchObject({ totalBottles: 2 });
  });

  test("finds and repairs wrong saved counts", async ({
    defaults,
    fixtures,
  }) => {
    const wrong = await fixtures.Collection({
      createdById: defaults.user.id,
      name: "Wrong count",
      totalBottles: 8,
    });
    const correctEmpty = await fixtures.Collection({
      createdById: defaults.user.id,
      name: "Correct empty",
      totalBottles: 0,
    });
    const bottle = await fixtures.Bottle();
    await db.insert(collectionBottles).values({
      collectionId: wrong.id,
      bottleId: bottle.id,
    });

    await expect(
      checkCollectionBottleCounts([wrong.id, correctEmpty.id]),
    ).resolves.toEqual([
      { collectionId: wrong.id, savedCount: 8, actualCount: 1 },
    ]);
    await expect(checkCollectionBottleCounts([])).resolves.toEqual([]);

    await expect(repairCollectionBottleCount(wrong.id)).resolves.toEqual({
      collectionId: wrong.id,
      savedCount: 8,
      actualCount: 1,
    });
    await expect(
      checkCollectionBottleCounts([wrong.id, correctEmpty.id]),
    ).resolves.toEqual([]);
    await expect(
      repairCollectionBottleCount(2_147_483_647),
    ).resolves.toBeNull();
  });

  test("recounts after an earlier membership change commits", async ({
    defaults,
    fixtures,
  }) => {
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 0,
    });
    const existingBottle = await fixtures.Bottle();
    const addedBottle = await fixtures.Bottle();
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: existingBottle.id,
    });

    const writer = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let writerCommitted = false;
    let repair: ReturnType<typeof repairCollectionBottleCount> | null = null;

    await writer.connect();
    await observer.connect();
    try {
      await writer.query("BEGIN");
      const writerPid = (
        await writer.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!writerPid) throw new Error("Unable to load Collection writer pid.");

      await writer.query("SELECT id FROM collection WHERE id = $1 FOR UPDATE", [
        collection.id,
      ]);
      await writer.query(
        "INSERT INTO collection_bottle (collection_id, bottle_id) VALUES ($1, $2)",
        [collection.id, addedBottle.id],
      );
      await writer.query(
        "UPDATE collection SET total_bottles = total_bottles + 1 WHERE id = $1",
        [collection.id],
      );

      repair = repairCollectionBottleCount(collection.id);
      void repair.catch(() => undefined);
      await waitForSessionBlockedBy(observer, writerPid);

      await writer.query("COMMIT");
      writerCommitted = true;

      await expect(repair).resolves.toEqual({
        collectionId: collection.id,
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
      db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      }),
    ).resolves.toMatchObject({ totalBottles: 2 });
  });
});
