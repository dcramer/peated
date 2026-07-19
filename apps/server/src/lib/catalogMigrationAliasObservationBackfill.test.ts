import { and, asc, eq, isNull } from "drizzle-orm";
import pg from "pg";
import { db } from "../db";
import { getPostgresConnectionConfig } from "../db/connection";
import {
  bottleAliases,
  bottleObservations,
  bottleReleasePromotions,
  catalogTargets,
} from "../db/schema";
import {
  backfillLegacyCatalogAliasObservationsForParent,
  CatalogMigrationAliasObservationBackfillError,
} from "./catalogMigrationAliasObservationBackfill";
import { backfillLegacyCatalogParent } from "./catalogMigrationBackfill";
import waitError from "./test/waitError";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

async function waitForSessionBlockedBy(
  observer: NodePgClient,
  blockerPid: number,
): Promise<number> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await observer.query<{ pid: number }>(
      `SELECT pid
       FROM pg_stat_activity
       WHERE $1 = ANY(pg_blocking_pids(pid))
       ORDER BY pid
       LIMIT 1`,
      [blockerPid],
    );
    const blockedPid = result.rows[0]?.pid;
    if (blockedPid) return blockedPid;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for catalog migration backfill lock.");
}

async function expectNowaitLockFailure(
  client: NodePgClient,
  query: string,
  values: unknown[],
) {
  await client.query("BEGIN");
  try {
    await expect(client.query(query, values)).rejects.toMatchObject({
      code: "55P03",
    });
  } finally {
    await client.query("ROLLBACK");
  }
}

async function exactTargetId(bottleId: number) {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
  });
  if (!target) throw new Error(`Missing exact target for Bottle ${bottleId}.`);
  return target.id;
}

async function genericTargetId(groupId: number) {
  const target = await db.query.catalogTargets.findFirst({
    where: and(
      eq(catalogTargets.groupId, groupId),
      isNull(catalogTargets.bottleId),
    ),
  });
  if (!target) throw new Error(`Missing generic target for group ${groupId}.`);
  return target.id;
}

async function insertObservation({
  bottleId,
  releaseId = null,
  targetId = null,
  sourceKey,
  sourceName = "Legacy source name",
  sourceUrl = "https://example.test/legacy-source",
  rawText = "original raw listing text",
  parsedIdentity = { edition: "Legacy Edition" },
  facts = { abv: 51.2 },
  createdAt = new Date("2020-01-02T03:04:05.000Z"),
  updatedAt = new Date("2021-02-03T04:05:06.000Z"),
  createdById = null,
}: {
  bottleId: number;
  releaseId?: number | null;
  targetId?: number | null;
  sourceKey: string;
  sourceName?: string;
  sourceUrl?: string;
  rawText?: string;
  parsedIdentity?: Record<string, unknown>;
  facts?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
  createdById?: number | null;
}) {
  const [observation] = await db
    .insert(bottleObservations)
    .values({
      bottleId,
      releaseId,
      targetId,
      sourceType: "store_price",
      sourceKey,
      sourceName,
      sourceUrl,
      rawText,
      parsedIdentity,
      facts,
      createdAt,
      updatedAt,
      createdById,
    })
    .returning();
  if (!observation) throw new Error("Unable to create observation fixture.");
  return observation;
}

async function loadAlias(name: string) {
  const alias = await db.query.bottleAliases.findFirst({
    where: eq(bottleAliases.name, name),
  });
  if (!alias) throw new Error(`Missing alias ${name}.`);
  return alias;
}

async function loadObservation(id: number) {
  const observation = await db.query.bottleObservations.findFirst({
    where: eq(bottleObservations.id, id),
  });
  if (!observation) throw new Error(`Missing observation ${id}.`);
  return observation;
}

async function expectBackfillError(
  promise: Promise<unknown>,
  expected: Partial<CatalogMigrationAliasObservationBackfillError>,
) {
  const error = await waitError(promise);
  expect(error).toBeInstanceOf(CatalogMigrationAliasObservationBackfillError);
  expect(error).toMatchObject(expected);
}

describe("legacy catalog alias and observation backfill", () => {
  test("maps a zero-release parent's aliases and observations to its retained exact target", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const parent = await fixtures.LegacyBottle({
      name: "Retained legacy expression",
      fullName: "Legacy Brand Retained legacy expression",
    });
    const aliasCreatedAt = new Date("2018-03-04T05:06:07.000Z");
    const alias = await fixtures.BottleAlias({
      bottleId: parent.id,
      releaseId: null,
      targetId: null,
      name: "Retained historical alias",
      ignored: true,
      assignmentSource: "human_approved",
      assignedByActorId: parent.createdByActorId,
      createdAt: aliasCreatedAt,
    });
    const observation = await insertObservation({
      bottleId: parent.id,
      sourceKey: "retained-parent-observation",
      createdById: user.id,
    });
    const promotion = await backfillLegacyCatalogParent(parent.id);
    const targetId = await exactTargetId(parent.id);

    const result = await backfillLegacyCatalogAliasObservationsForParent(
      parent.id,
    );

    expect(result).toEqual({
      parentId: parent.id,
      aliasRows: 2,
      aliasesUpdated: 2,
      aliasesReused: 0,
      observationRows: 1,
      observationsUpdated: 1,
      observationsReused: 0,
    });
    expect(promotion.retainedBottleId).toBe(parent.id);
    expect(await loadAlias(alias.name)).toEqual({ ...alias, targetId });
    expect(await loadObservation(observation.id)).toEqual({
      ...observation,
      targetId,
    });
  });

  test("maps split parent identity to the generic target and release identity to exact targets", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      name: "Split legacy family",
      fullName: "Legacy Brand Split legacy family",
    });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Split legacy release",
      fullName: "Legacy Brand Split legacy release",
    });
    const parentAlias = await fixtures.BottleAlias({
      bottleId: parent.id,
      releaseId: null,
      targetId: null,
      name: "Split family stable alias",
      assignmentSource: "legacy",
    });
    const releaseAlias = await fixtures.BottleAlias({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
      name: "Split release historical alias",
      ignored: true,
      assignmentSource: "human_approved",
      createdAt: new Date("2019-04-05T06:07:08.000Z"),
    });
    const parentObservation = await insertObservation({
      bottleId: parent.id,
      sourceKey: "split-parent-observation",
      sourceName: "Stable family listing",
    });
    const releaseObservation = await insertObservation({
      bottleId: parent.id,
      releaseId: release.id,
      sourceKey: "split-release-observation",
      sourceName: "Exact release listing",
      parsedIdentity: { releaseYear: 2020 },
      facts: { abv: 55.1, caskType: "bourbon" },
    });
    const promotion = await backfillLegacyCatalogParent(parent.id);
    const promoted = promotion.promoted[0]!;
    const genericId = await genericTargetId(promotion.groupId);
    const canonicalAliasBefore = await loadAlias(release.fullName);

    const result = await backfillLegacyCatalogAliasObservationsForParent(
      parent.id,
    );

    expect(result).toEqual({
      parentId: parent.id,
      aliasRows: 3,
      aliasesUpdated: 3,
      aliasesReused: 0,
      observationRows: 2,
      observationsUpdated: 2,
      observationsReused: 0,
    });
    expect(await loadAlias(parentAlias.name)).toEqual({
      ...parentAlias,
      targetId: genericId,
    });
    expect(await loadAlias(releaseAlias.name)).toEqual({
      ...releaseAlias,
      targetId: promoted.targetId,
    });
    expect(await loadAlias(release.fullName)).toEqual(canonicalAliasBefore);
    expect(canonicalAliasBefore).toMatchObject({
      bottleId: promoted.bottleId,
      releaseId: null,
      targetId: promoted.targetId,
      assignmentSource: "canonical",
    });
    expect(await loadObservation(parentObservation.id)).toEqual({
      ...parentObservation,
      targetId: genericId,
    });
    expect(await loadObservation(releaseObservation.id)).toEqual({
      ...releaseObservation,
      targetId: promoted.targetId,
    });
  });

  test("reuses matching pretargets and is idempotent without changing retained evidence", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      name: "Pretargeted legacy family",
      fullName: "Legacy Brand Pretargeted legacy family",
    });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Pretargeted legacy release",
      fullName: "Legacy Brand Pretargeted legacy release",
    });
    const alias = await fixtures.BottleAlias({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
      name: "Pretargeted release alias",
      ignored: true,
    });
    const observation = await insertObservation({
      bottleId: parent.id,
      releaseId: release.id,
      sourceKey: "pretargeted-release-observation",
    });
    const promotion = await backfillLegacyCatalogParent(parent.id);
    const targetId = promotion.promoted[0]!.targetId;
    const genericId = await genericTargetId(promotion.groupId);
    await db
      .update(bottleAliases)
      .set({ targetId })
      .where(eq(bottleAliases.name, alias.name));
    await db
      .update(bottleObservations)
      .set({ targetId })
      .where(eq(bottleObservations.id, observation.id));
    const aliasesBefore = await db
      .select()
      .from(bottleAliases)
      .where(eq(bottleAliases.bottleId, parent.id))
      .orderBy(asc(bottleAliases.name));
    const observationBefore = await loadObservation(observation.id);

    const first = await backfillLegacyCatalogAliasObservationsForParent(
      parent.id,
    );
    const second = await backfillLegacyCatalogAliasObservationsForParent(
      parent.id,
    );

    expect(first.aliasesUpdated).toBe(1);
    expect(first.aliasesReused).toBe(1);
    expect(first.observationsUpdated).toBe(0);
    expect(first.observationsReused).toBe(1);
    expect(second).toEqual({
      parentId: parent.id,
      aliasRows: 2,
      aliasesUpdated: 0,
      aliasesReused: 2,
      observationRows: 1,
      observationsUpdated: 0,
      observationsReused: 1,
    });
    expect(
      await db
        .select()
        .from(bottleAliases)
        .where(eq(bottleAliases.bottleId, parent.id))
        .orderBy(asc(bottleAliases.name)),
    ).toEqual(
      aliasesBefore.map((row) =>
        row.targetId === null ? { ...row, targetId: genericId } : row,
      ),
    );
    expect(await loadObservation(observation.id)).toEqual(observationBefore);
  });

  test("holds group and Bottle hierarchy locks while waiting for a CatalogTarget", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      name: "Hierarchy lock family",
      fullName: "Legacy Brand Hierarchy lock family",
    });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Hierarchy lock release",
      fullName: "Legacy Brand Hierarchy lock release",
    });
    const promotion = await backfillLegacyCatalogParent(parent.id);
    const promoted = promotion.promoted[0]!;
    const targetBlocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let backfill: ReturnType<
      typeof backfillLegacyCatalogAliasObservationsForParent
    > | null = null;
    let blockerCommitted = false;

    await targetBlocker.connect();
    await observer.connect();
    try {
      await targetBlocker.query("BEGIN");
      const blockerPid = (
        await targetBlocker.query<{ pid: number }>(
          "SELECT pg_backend_pid() AS pid",
        )
      ).rows[0]?.pid;
      if (!blockerPid) throw new Error("Unable to load target blocker pid.");
      await targetBlocker.query(
        "SELECT id FROM catalog_target WHERE id = $1 FOR UPDATE",
        [promoted.targetId],
      );

      backfill = backfillLegacyCatalogAliasObservationsForParent(parent.id);
      void backfill.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);

      await expectNowaitLockFailure(
        observer,
        "SELECT id FROM bottle_group WHERE id = $1 FOR UPDATE NOWAIT",
        [promotion.groupId],
      );
      await expectNowaitLockFailure(
        observer,
        "SELECT id FROM bottle WHERE id = $1 FOR UPDATE NOWAIT",
        [parent.id],
      );
      await expectNowaitLockFailure(
        observer,
        "SELECT id FROM bottle WHERE id = $1 FOR UPDATE NOWAIT",
        [promoted.bottleId],
      );

      await targetBlocker.query("COMMIT");
      blockerCommitted = true;
      await expect(backfill).resolves.toMatchObject({ parentId: parent.id });
    } finally {
      if (!blockerCommitted) {
        await targetBlocker.query("ROLLBACK").catch(() => undefined);
      }
      if (backfill) await backfill.catch(() => undefined);
      await targetBlocker.end();
      await observer.end();
    }
  });

  test("rejects a concurrently cleared observation target and rolls back the family", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      name: "Concurrent observation family",
      fullName: "Legacy Brand Concurrent observation family",
    });
    const earlierAlias = await fixtures.BottleAlias({
      bottleId: parent.id,
      targetId: null,
      name: "Concurrent observation earlier alias",
    });
    await backfillLegacyCatalogParent(parent.id);
    const targetId = await exactTargetId(parent.id);
    const observation = await insertObservation({
      bottleId: parent.id,
      targetId,
      sourceKey: "concurrently-cleared-observation",
    });
    const parentAliasBefore = await loadAlias(parent.fullName);
    const earlierAliasBefore = await loadAlias(earlierAlias.name);
    const blocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let backfill: ReturnType<
      typeof backfillLegacyCatalogAliasObservationsForParent
    > | null = null;
    let blockerCommitted = false;

    await blocker.connect();
    await observer.connect();
    try {
      await blocker.query("BEGIN");
      const blockerPid = (
        await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!blockerPid)
        throw new Error("Unable to load observation blocker pid.");
      await blocker.query(
        "SELECT id FROM bottle_observation WHERE id = $1 FOR UPDATE",
        [observation.id],
      );
      await blocker.query(
        "UPDATE bottle_observation SET target_id = NULL WHERE id = $1",
        [observation.id],
      );

      backfill = backfillLegacyCatalogAliasObservationsForParent(parent.id);
      void backfill.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);

      await blocker.query("COMMIT");
      blockerCommitted = true;
      await expectBackfillError(backfill, {
        code: "row_changed",
        parentId: parent.id,
        table: "bottle_observation",
        rowId: observation.id,
      });
    } finally {
      if (!blockerCommitted) {
        await blocker.query("ROLLBACK").catch(() => undefined);
      }
      if (backfill) await backfill.catch(() => undefined);
      await blocker.end();
      await observer.end();
    }

    expect(await loadAlias(parentAliasBefore.name)).toEqual(parentAliasBefore);
    expect(await loadAlias(earlierAlias.name)).toEqual(earlierAliasBefore);
    expect(await loadObservation(observation.id)).toEqual({
      ...observation,
      targetId: null,
    });
  });

  test("locks legacy release evidence before waiting for an alias", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      name: "Release evidence lock family",
      fullName: "Legacy Brand Release evidence lock family",
    });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Release evidence lock release",
      fullName: "Legacy Brand Release evidence lock release",
    });
    const alias = await fixtures.BottleAlias({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
      name: "Release evidence blocked alias",
    });
    await backfillLegacyCatalogParent(parent.id);
    const aliasBlocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let backfill: ReturnType<
      typeof backfillLegacyCatalogAliasObservationsForParent
    > | null = null;
    let blockerCommitted = false;

    await aliasBlocker.connect();
    await observer.connect();
    try {
      await aliasBlocker.query("BEGIN");
      const blockerPid = (
        await aliasBlocker.query<{ pid: number }>(
          "SELECT pg_backend_pid() AS pid",
        )
      ).rows[0]?.pid;
      if (!blockerPid) throw new Error("Unable to load alias blocker pid.");
      await aliasBlocker.query(
        "SELECT name FROM bottle_alias WHERE name = $1 FOR UPDATE",
        [alias.name],
      );

      backfill = backfillLegacyCatalogAliasObservationsForParent(parent.id);
      void backfill.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);

      await expectNowaitLockFailure(
        observer,
        "SELECT id FROM bottle_release WHERE id = $1 FOR UPDATE NOWAIT",
        [release.id],
      );
      await expectNowaitLockFailure(
        observer,
        "SELECT release_id FROM bottle_release_promotion WHERE release_id = $1 FOR UPDATE NOWAIT",
        [release.id],
      );

      await aliasBlocker.query("COMMIT");
      blockerCommitted = true;
      await expect(backfill).resolves.toMatchObject({ parentId: parent.id });
    } finally {
      if (!blockerCommitted) {
        await aliasBlocker.query("ROLLBACK").catch(() => undefined);
      }
      if (backfill) await backfill.catch(() => undefined);
      await aliasBlocker.end();
      await observer.end();
    }
  });

  test("rejects a conflicting durable target without overwriting it", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const alias = await fixtures.BottleAlias({
      bottleId: parent.id,
      targetId: null,
      name: "Conflicting durable alias target",
    });
    const promotion = await backfillLegacyCatalogParent(parent.id);
    const otherBottle = await fixtures.Bottle();
    const otherTargetId = await exactTargetId(otherBottle.id);
    await db
      .update(bottleAliases)
      .set({ targetId: otherTargetId })
      .where(eq(bottleAliases.name, alias.name));
    const before = await loadAlias(alias.name);

    await expectBackfillError(
      backfillLegacyCatalogAliasObservationsForParent(parent.id),
      {
        code: "target_conflict",
        parentId: parent.id,
        table: "bottle_alias",
        rowId: alias.name,
      },
    );

    expect(promotion.retainedBottleId).toBe(parent.id);
    expect(await loadAlias(alias.name)).toEqual(before);
  });

  test("rejects invalid legacy pairs and incomplete promotions", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const otherParent = await fixtures.LegacyBottle();
    const release = await fixtures.BottleRelease({ bottleId: otherParent.id });
    const invalidAlias = await fixtures.BottleAlias({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
      name: "Invalid cross-parent release alias",
    });
    await backfillLegacyCatalogParent(parent.id);

    await expectBackfillError(
      backfillLegacyCatalogAliasObservationsForParent(parent.id),
      {
        code: "target_resolution_failed",
        parentId: parent.id,
        table: "bottle_alias",
        rowId: invalidAlias.name,
      },
    );
    expect(await loadAlias(invalidAlias.name)).toEqual(invalidAlias);

    const incompleteParent = await fixtures.LegacyBottle();
    const incompleteRelease = await fixtures.BottleRelease({
      bottleId: incompleteParent.id,
    });
    const incompleteObservation = await insertObservation({
      bottleId: incompleteParent.id,
      releaseId: incompleteRelease.id,
      sourceKey: "incomplete-promotion-observation",
    });

    await expectBackfillError(
      backfillLegacyCatalogAliasObservationsForParent(incompleteParent.id),
      {
        code: "target_resolution_failed",
        parentId: incompleteParent.id,
      },
    );
    expect(await loadObservation(incompleteObservation.id)).toEqual(
      incompleteObservation,
    );
    expect(
      await db
        .select()
        .from(bottleReleasePromotions)
        .where(eq(bottleReleasePromotions.releaseId, incompleteRelease.id)),
    ).toEqual([]);
  });

  test("rejects family release rows whose retained Bottle belongs to another parent", async ({
    fixtures,
  }) => {
    const aliasParent = await fixtures.LegacyBottle({
      name: "Inverse alias pair family",
      fullName: "Legacy Brand Inverse alias pair family",
    });
    const aliasRelease = await fixtures.BottleRelease({
      bottleId: aliasParent.id,
      name: "Inverse alias pair release",
      fullName: "Legacy Brand Inverse alias pair release",
    });
    const aliasOtherParent = await fixtures.LegacyBottle();
    const invalidAlias = await fixtures.BottleAlias({
      bottleId: aliasOtherParent.id,
      releaseId: aliasRelease.id,
      targetId: null,
      name: "Inverse invalid release alias",
    });
    await backfillLegacyCatalogParent(aliasParent.id);

    await expectBackfillError(
      backfillLegacyCatalogAliasObservationsForParent(aliasParent.id),
      {
        code: "target_resolution_failed",
        parentId: aliasParent.id,
        table: "bottle_alias",
        rowId: invalidAlias.name,
      },
    );
    expect(await loadAlias(invalidAlias.name)).toEqual(invalidAlias);

    const observationParent = await fixtures.LegacyBottle({
      name: "Inverse observation pair family",
      fullName: "Legacy Brand Inverse observation pair family",
    });
    const observationRelease = await fixtures.BottleRelease({
      bottleId: observationParent.id,
      name: "Inverse observation pair release",
      fullName: "Legacy Brand Inverse observation pair release",
    });
    const observationOtherParent = await fixtures.LegacyBottle();
    const invalidObservation = await insertObservation({
      bottleId: observationOtherParent.id,
      releaseId: observationRelease.id,
      sourceKey: "inverse-invalid-release-observation",
    });
    await backfillLegacyCatalogParent(observationParent.id);

    await expectBackfillError(
      backfillLegacyCatalogAliasObservationsForParent(observationParent.id),
      {
        code: "target_resolution_failed",
        parentId: observationParent.id,
        table: "bottle_observation",
        rowId: invalidObservation.id,
      },
    );
    expect(await loadObservation(invalidObservation.id)).toEqual(
      invalidObservation,
    );
  });

  test("rolls back every alias and observation update when a later row conflicts", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const validAlias = await fixtures.BottleAlias({
      bottleId: parent.id,
      targetId: null,
      name: "A valid earlier family alias",
    });
    const validObservation = await insertObservation({
      bottleId: parent.id,
      sourceKey: "a-valid-earlier-family-observation",
    });
    const conflictingObservation = await insertObservation({
      bottleId: parent.id,
      sourceKey: "z-conflicting-later-family-observation",
    });
    await backfillLegacyCatalogParent(parent.id);
    const otherBottle = await fixtures.Bottle();
    const otherTargetId = await exactTargetId(otherBottle.id);
    await db
      .update(bottleObservations)
      .set({ targetId: otherTargetId })
      .where(eq(bottleObservations.id, conflictingObservation.id));
    const aliasBefore = await loadAlias(validAlias.name);
    const validObservationBefore = await loadObservation(validObservation.id);
    const conflictingObservationBefore = await loadObservation(
      conflictingObservation.id,
    );

    await expectBackfillError(
      backfillLegacyCatalogAliasObservationsForParent(parent.id),
      {
        code: "target_conflict",
        parentId: parent.id,
        table: "bottle_observation",
        rowId: conflictingObservation.id,
      },
    );

    expect(await loadAlias(validAlias.name)).toEqual(aliasBefore);
    expect(await loadObservation(validObservation.id)).toEqual(
      validObservationBefore,
    );
    expect(await loadObservation(conflictingObservation.id)).toEqual(
      conflictingObservationBefore,
    );
  });
});
