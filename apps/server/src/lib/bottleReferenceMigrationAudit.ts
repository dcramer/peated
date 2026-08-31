import type { AnyDatabase } from "@peated/server/db";
import { db } from "@peated/server/db";
import {
  BOTTLE_REFERENCE_ASSIGNMENT_SOURCES,
  bottles,
  bottleTombstones,
} from "@peated/server/db/schema";
import { normalizeBottleReferenceKey } from "@peated/server/lib/normalize";
import { asc, isNotNull, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod";

type ReferenceStorage = "legacy_alias" | "reference";

type ReferenceAuditRow = {
  assignedByActorId: number;
  assignmentSource: string;
  bottleId: number | null;
  createdAt: Date | string;
  hasEmbedding: boolean;
  ignored: boolean | null;
  legacyReleaseId: number | null;
  name: string;
};

export type BottleReferenceMigrationReport = {
  storage: ReferenceStorage;
  fingerprint: string;
  totals: {
    all: number;
    assigned: number;
    unresolved: number;
    ignored: number;
    embedded: number;
    retiredAssigned: number;
  };
  byAssignmentSource: Record<string, number>;
  canonicalCoverage: {
    activeBottles: number;
    coveredBottles: number;
    missingBottleIds: number[];
  };
  collisions: {
    caseInsensitive: number;
    normalized: number;
    normalizedExamples: string[][];
  };
};

const BottleReferenceMigrationReportSchema = z.object({
  storage: z.enum(["legacy_alias", "reference"]),
  fingerprint: z.string(),
  totals: z.object({
    all: z.number(),
    assigned: z.number(),
    unresolved: z.number(),
    ignored: z.number(),
    embedded: z.number(),
    retiredAssigned: z.number(),
  }),
  byAssignmentSource: z.record(z.string(), z.number()),
  canonicalCoverage: z.object({
    activeBottles: z.number(),
    coveredBottles: z.number(),
    missingBottleIds: z.array(z.number()),
  }),
  collisions: z.object({
    caseInsensitive: z.number(),
    normalized: z.number(),
    normalizedExamples: z.array(z.array(z.string())),
  }),
});

export function parseBottleReferenceMigrationReport(
  value: string,
): BottleReferenceMigrationReport {
  return BottleReferenceMigrationReportSchema.parse(JSON.parse(value));
}

function storageTable(storage: ReferenceStorage) {
  return storage === "legacy_alias"
    ? sql.raw('"bottle_alias"')
    : sql.raw('"bottle_reference"');
}

function toFingerprint(rows: ReferenceAuditRow[]) {
  const hash = createHash("sha256");
  for (const row of rows) {
    hash.update(
      JSON.stringify([
        row.name,
        row.bottleId,
        row.legacyReleaseId,
        row.ignored,
        row.assignmentSource,
        row.assignedByActorId,
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : new Date(row.createdAt).toISOString(),
        row.hasEmbedding,
      ]),
    );
    hash.update("\n");
  }
  return hash.digest("hex");
}

function findNormalizedCollisions(rows: ReferenceAuditRow[]) {
  const namesByKey = new Map<string, string[]>();
  for (const { name } of rows) {
    const key = normalizeBottleReferenceKey(name).toLowerCase();
    const names = namesByKey.get(key) ?? [];
    names.push(name);
    namesByKey.set(key, names);
  }
  return Array.from(namesByKey.values())
    .filter((names) => names.length > 1)
    .sort(([left = ""], [right = ""]) => left.localeCompare(right));
}

/**
 * Reads only columns shared by the legacy and current storage so the same
 * report can prove the coordinated table rename did not change identity.
 */
export async function getBottleReferenceMigrationReport(
  {
    storage = "reference",
  }: {
    storage?: ReferenceStorage;
  } = {},
  database: AnyDatabase = db,
): Promise<BottleReferenceMigrationReport> {
  const relation = storageTable(storage);
  const [{ rows: storedRows }, bottleRows, tombstoneRows] = await Promise.all([
    database.execute<ReferenceAuditRow>(sql`
      SELECT
        name,
        bottle_id AS "bottleId",
        release_id AS "legacyReleaseId",
        ignored,
        assignment_source AS "assignmentSource",
        assigned_by_actor_id AS "assignedByActorId",
        created_at AS "createdAt",
        embedding IS NOT NULL AS "hasEmbedding"
      FROM ${relation}
      ORDER BY LOWER(name), name
    `),
    database
      .select({
        id: bottles.id,
        fullName: bottles.fullName,
        active: isNotNull(bottles.groupId),
      })
      .from(bottles)
      .orderBy(asc(bottles.id)),
    database
      .select({ bottleId: bottleTombstones.bottleId })
      .from(bottleTombstones),
  ]);
  const rows = storedRows.map((row) => ({
    ...row,
    assignedByActorId: Number(row.assignedByActorId),
    bottleId: row.bottleId === null ? null : Number(row.bottleId),
    legacyReleaseId:
      row.legacyReleaseId === null ? null : Number(row.legacyReleaseId),
  }));

  const retiredBottleIds = new Set(
    tombstoneRows.map(({ bottleId }) => bottleId),
  );
  const activeBottles = bottleRows.filter(
    ({ active, id }) => active && !retiredBottleIds.has(id),
  );
  const activeReferenceNamesByBottle = new Map<number, Set<string>>();
  for (const row of rows) {
    if (row.bottleId === null || row.ignored === true) continue;
    const names = activeReferenceNamesByBottle.get(row.bottleId) ?? new Set();
    names.add(row.name.toLowerCase());
    activeReferenceNamesByBottle.set(row.bottleId, names);
  }
  const missingBottleIds = activeBottles
    .filter(
      ({ id, fullName }) =>
        !activeReferenceNamesByBottle.get(id)?.has(fullName.toLowerCase()),
    )
    .map(({ id }) => id);

  const byAssignmentSource = Object.fromEntries(
    BOTTLE_REFERENCE_ASSIGNMENT_SOURCES.map((source) => [source, 0]),
  );
  for (const row of rows) {
    byAssignmentSource[row.assignmentSource] =
      (byAssignmentSource[row.assignmentSource] ?? 0) + 1;
  }

  const lowerNameCounts = new Map<string, number>();
  for (const { name } of rows) {
    const key = name.toLowerCase();
    lowerNameCounts.set(key, (lowerNameCounts.get(key) ?? 0) + 1);
  }
  const normalizedCollisions = findNormalizedCollisions(rows);

  return {
    storage,
    fingerprint: toFingerprint(rows),
    totals: {
      all: rows.length,
      assigned: rows.filter(({ bottleId }) => bottleId !== null).length,
      unresolved: rows.filter(({ bottleId }) => bottleId === null).length,
      ignored: rows.filter(({ ignored }) => ignored === true).length,
      embedded: rows.filter(({ hasEmbedding }) => hasEmbedding).length,
      retiredAssigned: rows.filter(
        ({ bottleId }) => bottleId !== null && retiredBottleIds.has(bottleId),
      ).length,
    },
    byAssignmentSource,
    canonicalCoverage: {
      activeBottles: activeBottles.length,
      coveredBottles: activeBottles.length - missingBottleIds.length,
      missingBottleIds: missingBottleIds.slice(0, 100),
    },
    collisions: {
      caseInsensitive: Array.from(lowerNameCounts.values()).filter(
        (count) => count > 1,
      ).length,
      normalized: normalizedCollisions.length,
      normalizedExamples: normalizedCollisions
        .slice(0, 20)
        .map((names) => names.slice(0, 10)),
    },
  };
}

export function assertBottleReferenceMigrationReportsMatch(
  expected: BottleReferenceMigrationReport,
  actual: BottleReferenceMigrationReport,
) {
  const { storage: _expectedStorage, ...expectedIdentity } = expected;
  const { storage: _actualStorage, ...actualIdentity } = actual;
  if (JSON.stringify(actualIdentity) !== JSON.stringify(expectedIdentity)) {
    throw new Error(
      "BottleReference migration postflight does not match preflight.",
    );
  }
}
