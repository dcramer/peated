import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import {
  bottleSeries,
  bottleTombstones,
  bottles,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import pg from "pg";
import {
  checkBottleSeriesReleaseCounts,
  getBottleSeriesMemberships,
  repairBottleSeriesReleaseCount,
  updateBottleSeriesReleaseCounts,
} from "./bottleSeriesReleaseCounts";

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
  throw new Error("Timed out waiting for the BottleSeries repair lock.");
}

describe("BottleSeries release counts", () => {
  test("moves only the changed Bottle between series", async ({ fixtures }) => {
    const oldSeries = await fixtures.BottleSeries({ numReleases: 1 });
    const newSeries = await fixtures.BottleSeries({ numReleases: 0 });
    const bottle = await fixtures.Bottle({ seriesId: oldSeries.id });

    await db.transaction(async (tx) => {
      const before = await getBottleSeriesMemberships(tx, [bottle.id]);
      await tx
        .update(bottles)
        .set({ seriesId: newSeries.id })
        .where(eq(bottles.id, bottle.id));
      const after = await getBottleSeriesMemberships(tx, [bottle.id]);
      await updateBottleSeriesReleaseCounts(tx, before, after);
    });

    await expect(
      db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, oldSeries.id),
      }),
    ).resolves.toMatchObject({ numReleases: 0 });
    await expect(
      db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, newSeries.id),
      }),
    ).resolves.toMatchObject({ numReleases: 1 });
  });

  test("repairs an old undercount when removing a Bottle", async ({
    fixtures,
  }) => {
    const series = await fixtures.BottleSeries({ numReleases: 0 });
    const removedBottle = await fixtures.Bottle({ seriesId: series.id });
    await fixtures.Bottle({ seriesId: series.id });

    await db.transaction(async (tx) => {
      const before = await getBottleSeriesMemberships(tx, [removedBottle.id]);
      await tx.insert(bottleTombstones).values({
        bottleId: removedBottle.id,
      });
      const after = await getBottleSeriesMemberships(tx, [removedBottle.id]);
      await updateBottleSeriesReleaseCounts(tx, before, after);
    });

    await expect(
      db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, series.id),
      }),
    ).resolves.toMatchObject({ numReleases: 1 });
    await expect(checkBottleSeriesReleaseCounts([series.id])).resolves.toEqual(
      [],
    );
  });

  test("rolls back earlier changes when a BottleSeries is missing", async ({
    fixtures,
  }) => {
    const series = await fixtures.BottleSeries({ numReleases: 0 });
    const missingSeriesId = 2_147_483_647;

    await expect(
      db.transaction((tx) =>
        updateBottleSeriesReleaseCounts(
          tx,
          [],
          [
            { bottleId: 10, seriesId: series.id },
            { bottleId: 11, seriesId: missingSeriesId },
          ],
        ),
      ),
    ).rejects.toThrow(
      `Cannot update release count: BottleSeries ${missingSeriesId} is missing.`,
    );
    await expect(
      db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, series.id),
      }),
    ).resolves.toMatchObject({ numReleases: 0 });
  });

  test("counts concurrent Bottles without losing an update", async ({
    fixtures,
  }) => {
    const series = await fixtures.BottleSeries({ numReleases: 0 });
    const first = await fixtures.Bottle({ seriesId: series.id });
    const second = await fixtures.Bottle({ seriesId: series.id });

    await Promise.all(
      [first.id, second.id].map((bottleId) =>
        db.transaction(async (tx) => {
          const after = await getBottleSeriesMemberships(tx, [bottleId]);
          await updateBottleSeriesReleaseCounts(tx, [], after);
        }),
      ),
    );

    await expect(
      db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, series.id),
      }),
    ).resolves.toMatchObject({ numReleases: 2 });
  });

  test("finds and repairs wrong saved counts", async ({ fixtures }) => {
    const wrong = await fixtures.BottleSeries({ numReleases: 8 });
    const correctEmpty = await fixtures.BottleSeries({ numReleases: 0 });
    await fixtures.Bottle({ seriesId: wrong.id });
    await db
      .update(bottleSeries)
      .set({ numReleases: 8 })
      .where(eq(bottleSeries.id, wrong.id));

    await expect(
      checkBottleSeriesReleaseCounts([wrong.id, correctEmpty.id]),
    ).resolves.toEqual([{ seriesId: wrong.id, savedCount: 8, actualCount: 1 }]);
    await expect(checkBottleSeriesReleaseCounts([])).resolves.toEqual([]);

    await expect(repairBottleSeriesReleaseCount(wrong.id)).resolves.toEqual({
      seriesId: wrong.id,
      savedCount: 8,
      actualCount: 1,
    });
    await expect(
      checkBottleSeriesReleaseCounts([wrong.id, correctEmpty.id]),
    ).resolves.toEqual([]);
    await expect(
      repairBottleSeriesReleaseCount(2_147_483_647),
    ).resolves.toBeNull();
  });

  test("recounts after an earlier Bottle change commits", async ({
    fixtures,
  }) => {
    const target = await fixtures.BottleSeries({ numReleases: 0 });
    const source = await fixtures.BottleSeries({ numReleases: 1 });
    await fixtures.Bottle({ seriesId: target.id });
    const movingBottle = await fixtures.Bottle({ seriesId: source.id });

    const writer = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let writerCommitted = false;
    let repair: ReturnType<typeof repairBottleSeriesReleaseCount> | null = null;

    await writer.connect();
    await observer.connect();
    try {
      await writer.query("BEGIN");
      const writerPid = (
        await writer.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!writerPid) throw new Error("Unable to load Bottle writer pid.");

      await writer.query(
        "SELECT id FROM bottle_series WHERE id = $1 FOR UPDATE",
        [target.id],
      );
      await writer.query("UPDATE bottle SET series_id = $2 WHERE id = $1", [
        movingBottle.id,
        target.id,
      ]);
      await writer.query(
        "UPDATE bottle_series SET num_releases = num_releases + 1 WHERE id = $1",
        [target.id],
      );

      repair = repairBottleSeriesReleaseCount(target.id);
      void repair.catch(() => undefined);
      await waitForSessionBlockedBy(observer, writerPid);

      await writer.query("COMMIT");
      writerCommitted = true;

      await expect(repair).resolves.toEqual({
        seriesId: target.id,
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
      db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, target.id),
      }),
    ).resolves.toMatchObject({ numReleases: 2 });
  });
});
