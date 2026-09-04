import type { RatingBandId } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import type { Bottle } from "@peated/server/db/schema";
import {
  bottleGroups,
  bottles,
  bottleTombstones,
  memberReviews,
  tastings,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import pg from "pg";
import {
  BottleGroupStatsIntegrityError,
  checkBottleGroupBottleCounts,
  recomputeBottleGroupStats,
  recomputeBottleGroupStatsInTransaction,
  repairBottleGroupBottleCount,
} from "./recomputeBottleGroupStats";

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
  throw new Error("Timed out waiting for the BottleGroup repair lock.");
}

function requireGroupId(groupId: number | null): number {
  if (groupId === null) throw new Error("Missing BottleGroup fixture");
  return groupId;
}

async function createMember(source: Bottle, name: string) {
  const [bottle] = await db
    .insert(bottles)
    .values({
      groupId: source.groupId,
      name,
      fullName: name,
      brandId: source.brandId,
      createdByActorId: source.createdByActorId,
    })
    .returning();
  if (!bottle) throw new Error("Unable to create member Bottle fixture");
  return bottle;
}

async function createTasting(
  bottleId: number,
  createdById: number,
  ratingBand: RatingBandId | null,
  sequence: number,
) {
  await db.insert(tastings).values({
    bottleId,
    ratingBand,
    createdById,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, sequence)),
  });
}

describe("BottleGroup statistics recomputation", () => {
  test("counts active member Bottles once", async ({ defaults, fixtures }) => {
    const first = await fixtures.Bottle();
    const second = await createMember(first, "Aggregate Member Two");
    const unrelated = await fixtures.Bottle();

    await createTasting(first.id, defaults.user.id, "good", 1);
    await createTasting(first.id, defaults.user.id, "outstanding", 2);
    await createTasting(second.id, defaults.user.id, "unicorn", 3);
    await createTasting(unrelated.id, defaults.user.id, "unicorn", 4);
    for (let index = 0; index < 20; index += 1) {
      const member = index === 0 ? defaults.user : await fixtures.User();
      await db.insert(memberReviews).values({
        bottleId: index % 2 === 0 ? first.id : second.id,
        createdById: member.id,
        score: 75 + index,
      });
    }

    const firstResult = await db.transaction((tx) =>
      recomputeBottleGroupStatsInTransaction(tx, requireGroupId(first.groupId)),
    );
    const secondResult = await recomputeBottleGroupStats(
      requireGroupId(first.groupId),
    );

    expect(firstResult).toMatchObject({
      id: first.groupId,
      totalBottles: 2,
      totalTastings: 3,
      medianScore: 84,
      minScore: 75,
      maxScore: 94,
      memberScoreCount: 20,
      externalScoreCount: 0,
      reviewScoreBandCounts: {
        mediocre: 5,
        good: 5,
        very_good: 5,
        outstanding: 5,
        unicorn: 0,
      },
      tastingBandCounts: {
        mediocre: 0,
        good: 1,
        very_good: 0,
        outstanding: 1,
        unicorn: 1,
      },
    });
    const { updatedAt: _firstUpdatedAt, ...firstStats } = firstResult;
    expect(secondResult).toMatchObject(firstStats);
  });

  test("excludes retired members and their activity", async ({
    defaults,
    fixtures,
  }) => {
    const active = await fixtures.Bottle();
    const retired = await createMember(active, "Retired Aggregate Member");
    const replacement = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });
    await createTasting(active.id, defaults.user.id, null, 1);
    await createTasting(retired.id, defaults.user.id, "unicorn", 2);

    await expect(
      recomputeBottleGroupStats(requireGroupId(active.groupId)),
    ).resolves.toMatchObject({
      totalBottles: 1,
      totalTastings: 1,
      memberScoreCount: 0,
      externalScoreCount: 0,
      reviewScoreBandCounts: { unicorn: 0 },
      tastingBandCounts: { unicorn: 0 },
    });
  });

  test("rejects missing groups and groups without active members", async ({
    fixtures,
  }) => {
    const missingError = await waitError(recomputeBottleGroupStats(999_999));
    expect(missingError).toBeInstanceOf(BottleGroupStatsIntegrityError);
    expect(missingError).toMatchObject({ code: "not_found", groupId: 999_999 });

    const destination = await fixtures.Bottle();
    const onlyMember = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: onlyMember.id,
      newBottleId: destination.id,
    });
    const before = await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, requireGroupId(onlyMember.groupId)),
    });
    await expect(
      recomputeBottleGroupStats(requireGroupId(onlyMember.groupId)),
    ).rejects.toMatchObject({
      code: "invalid_catalog_graph",
      groupId: onlyMember.groupId,
    });
    await expect(
      db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, requireGroupId(onlyMember.groupId)),
      }),
    ).resolves.toEqual(before);
  });

  test("finds and repairs wrong Bottle totals", async ({ fixtures }) => {
    const wrong = await fixtures.Bottle();
    const correct = await fixtures.Bottle();
    const [emptyGroup] = await db
      .insert(bottleGroups)
      .values({
        name: "Empty Group",
        fullName: "Empty Group",
        brandId: wrong.brandId,
        createdByActorId: wrong.createdByActorId,
        totalBottles: 4,
      })
      .returning();
    if (!emptyGroup) throw new Error("Unable to create empty BottleGroup");
    await db
      .update(bottleGroups)
      .set({ totalBottles: 9 })
      .where(eq(bottleGroups.id, wrong.groupId));

    const groupIds = [wrong.groupId, correct.groupId, emptyGroup.id];
    await expect(checkBottleGroupBottleCounts(groupIds)).resolves.toEqual([
      {
        groupId: wrong.groupId,
        savedCount: 9,
        actualCount: 1,
      },
      {
        groupId: emptyGroup.id,
        savedCount: 4,
        actualCount: 0,
      },
    ]);
    await expect(checkBottleGroupBottleCounts([])).resolves.toEqual([]);

    await expect(repairBottleGroupBottleCount(wrong.groupId)).resolves.toEqual({
      groupId: wrong.groupId,
      savedCount: 9,
      actualCount: 1,
    });
    await expect(repairBottleGroupBottleCount(emptyGroup.id)).resolves.toEqual({
      groupId: emptyGroup.id,
      savedCount: 4,
      actualCount: 0,
    });
    await expect(
      repairBottleGroupBottleCount(wrong.groupId),
    ).resolves.toBeNull();
    await expect(repairBottleGroupBottleCount(999_999)).resolves.toBeNull();
    await expect(checkBottleGroupBottleCounts(groupIds)).resolves.toEqual([]);
  });

  test("recounts after an earlier member change commits", async ({
    fixtures,
  }) => {
    const first = await fixtures.Bottle();
    const retired = await fixtures.BottleGroupMember({
      groupId: first.groupId,
    });
    const writer = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let writerCommitted = false;
    let repair: ReturnType<typeof repairBottleGroupBottleCount> | null = null;

    await writer.connect();
    await observer.connect();
    try {
      await writer.query("BEGIN");
      const writerPid = (
        await writer.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!writerPid) throw new Error("Unable to load Bottle writer pid.");

      await writer.query(
        "SELECT id FROM bottle_group WHERE id = $1 FOR UPDATE",
        [first.groupId],
      );
      await writer.query(
        "INSERT INTO bottle_tombstone (bottle_id) VALUES ($1)",
        [retired.id],
      );
      await writer.query(
        "UPDATE bottle_group SET total_bottles = 7 WHERE id = $1",
        [first.groupId],
      );

      repair = repairBottleGroupBottleCount(first.groupId);
      void repair.catch(() => undefined);
      await waitForSessionBlockedBy(observer, writerPid);

      await writer.query("COMMIT");
      writerCommitted = true;

      await expect(repair).resolves.toEqual({
        groupId: first.groupId,
        savedCount: 7,
        actualCount: 1,
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
      db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, first.groupId),
      }),
    ).resolves.toMatchObject({ totalBottles: 1 });
  });
});
