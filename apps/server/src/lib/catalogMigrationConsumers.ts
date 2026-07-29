import type { AnyTransaction } from "@peated/server/db";
import {
  CATALOG_MIGRATION_CONSUMER_SLOTS,
  type CatalogMigrationConsumerResult,
  type CatalogMigrationConsumerSlot,
} from "@peated/server/schemas/catalogMigrationApply";
import { sql } from "drizzle-orm";

export { CATALOG_MIGRATION_CONSUMER_SLOTS };
export type { CatalogMigrationConsumerResult, CatalogMigrationConsumerSlot };

export type CatalogMigrationConsumerMapping = {
  releaseId: number;
  legacyParentBottleId: number;
  promotedBottleId: number;
};

const consumerPreflightBrand: unique symbol = Symbol(
  "CatalogMigrationConsumerPreflight",
);

/**
 * An exact, zero-write consumer snapshot collected while the migration's table
 * locks are held and before any family rows are inserted.
 */
export type CatalogMigrationConsumerPreflight = Readonly<{
  bySlot: Readonly<CatalogMigrationConsumerResult["bySlot"]>;
  total: number;
  [consumerPreflightBrand]: true;
}>;

export type CatalogMigrationConsumerErrorCode =
  | "invalid_pair"
  | "membership_conflict"
  | "promotion_missing"
  | "promotion_mismatch"
  | "inactive_bottle"
  | "group_mismatch"
  | "mutation_count_mismatch"
  | "postflight_failed";

export class CatalogMigrationConsumerError extends Error {
  constructor(
    readonly code: CatalogMigrationConsumerErrorCode,
    readonly slot: CatalogMigrationConsumerSlot | null,
    readonly rowId: string | number | null,
    readonly details: Record<string, unknown> = {},
  ) {
    super(
      `Catalog migration consumer ${code}${slot ? ` in ${slot}` : ""}${rowId === null ? "" : ` at ${rowId}`}.`,
    );
    this.name = "CatalogMigrationConsumerError";
  }
}

type ConsumerSlotDefinition = {
  slot: CatalogMigrationConsumerSlot;
  table: string;
  bottleColumn: string;
  releaseColumn: string;
  rowId: string;
};

const CONSUMER_SLOT_DEFINITIONS = [
  {
    slot: "bottle_alias",
    table: "bottle_alias",
    bottleColumn: "bottle_id",
    releaseColumn: "release_id",
    rowId: "name",
  },
  {
    slot: "bottle_observation",
    table: "bottle_observation",
    bottleColumn: "bottle_id",
    releaseColumn: "release_id",
    rowId: "id",
  },
  {
    slot: "tasting",
    table: "tasting",
    bottleColumn: "bottle_id",
    releaseColumn: "release_id",
    rowId: "id",
  },
  {
    slot: "review",
    table: "review",
    bottleColumn: "bottle_id",
    releaseColumn: "release_id",
    rowId: "id",
  },
  {
    slot: "collection_bottle",
    table: "collection_bottle",
    bottleColumn: "bottle_id",
    releaseColumn: "release_id",
    rowId: "id",
  },
  {
    slot: "flight_bottle",
    table: "flight_bottle",
    bottleColumn: "bottle_id",
    releaseColumn: "release_id",
    rowId:
      "CONCAT(flight_id, ':', COALESCE(bottle_id::text, 'null'), ':', release_id)",
  },
  {
    slot: "store_price",
    table: "store_price",
    bottleColumn: "bottle_id",
    releaseColumn: "release_id",
    rowId: "id",
  },
  {
    slot: "incoming_bottle_decision_log",
    table: "incoming_bottle_decision_log",
    bottleColumn: "bottle_id",
    releaseColumn: "release_id",
    rowId: "id",
  },
  {
    slot: "store_price_match_proposal.current",
    table: "store_price_match_proposal",
    bottleColumn: "current_bottle_id",
    releaseColumn: "current_release_id",
    rowId: "id",
  },
  {
    slot: "store_price_match_proposal.suggested",
    table: "store_price_match_proposal",
    bottleColumn: "suggested_bottle_id",
    releaseColumn: "suggested_release_id",
    rowId: "id",
  },
  {
    slot: "store_price_match_attempt.current",
    table: "store_price_match_attempt",
    bottleColumn: "current_bottle_id",
    releaseColumn: "current_release_id",
    rowId: "id",
  },
  {
    slot: "store_price_match_attempt.suggested",
    table: "store_price_match_attempt",
    bottleColumn: "suggested_bottle_id",
    releaseColumn: "suggested_release_id",
    rowId: "id",
  },
] as const satisfies readonly ConsumerSlotDefinition[];

type ConsumerCountRow = {
  slot: CatalogMigrationConsumerSlot;
  count: number;
};

type InvalidPairRow = {
  slot: CatalogMigrationConsumerSlot;
  rowId: string;
  bottleId: number | null;
  releaseId: number;
  expectedBottleId: number | null;
};

type MembershipConflictRow = {
  slot: "tasting" | "collection_bottle" | "flight_bottle";
  rowId: string;
  finalKey: string;
};

type InvalidPromotionRow = {
  releaseId: number;
  parentBottleId: number;
  promotedBottleId: number | null;
  reason:
    | "promotion_missing"
    | "promotion_matches_parent"
    | "parent_inactive"
    | "promoted_inactive"
    | "group_mismatch";
  parentGroupId: number | null;
  promotedGroupId: number | null;
};

function firstRow<T>(rows: T[], label: string): T {
  const row = rows[0];
  if (!row) {
    throw new CatalogMigrationConsumerError("postflight_failed", null, null, {
      reason: `${label}_missing`,
    });
  }
  return row;
}

function sqlIdList(releaseIds: readonly number[] | undefined): string | null {
  if (releaseIds === undefined) return null;
  if (
    !releaseIds.length ||
    releaseIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
  ) {
    throw new CatalogMigrationConsumerError("postflight_failed", null, null, {
      reason: "invalid_release_scope",
      releaseIds,
    });
  }
  return [...new Set(releaseIds)].join(",");
}

function referencesSql(releaseIds?: readonly number[]): string {
  const scopedIds = sqlIdList(releaseIds);
  return CONSUMER_SLOT_DEFINITIONS.map(
    ({ slot, table, bottleColumn, releaseColumn, rowId }) => `
      SELECT
        '${slot}'::text AS slot,
        (${rowId})::text AS row_id,
        ${bottleColumn} AS bottle_id,
        ${releaseColumn} AS release_id
      FROM ${table}
      WHERE ${releaseColumn} IS NOT NULL
        ${scopedIds === null ? "" : `AND ${releaseColumn} IN (${scopedIds})`}
    `,
  ).join("\nUNION ALL\n");
}

function emptyResult(): CatalogMigrationConsumerResult {
  return {
    bySlot: Object.fromEntries(
      CATALOG_MIGRATION_CONSUMER_SLOTS.map((slot) => [slot, 0]),
    ) as CatalogMigrationConsumerResult["bySlot"],
    total: 0,
  };
}

async function loadConsumerCounts(
  tx: AnyTransaction,
  releaseIds?: readonly number[],
): Promise<CatalogMigrationConsumerResult> {
  const result = await tx.execute<ConsumerCountRow>(
    sql.raw(`
    WITH refs AS (${referencesSql(releaseIds)})
    SELECT slot, COUNT(*)::int AS count
    FROM refs
    GROUP BY slot
  `),
  );
  const counts = emptyResult();
  for (const row of result.rows) {
    counts.bySlot[row.slot] = row.count;
    counts.total += row.count;
  }
  return counts;
}

async function assertNoMembershipConflicts(
  tx: AnyTransaction,
  releaseIds?: readonly number[],
): Promise<void> {
  const scopedIds = sqlIdList(releaseIds);
  const releaseScope = (qualifier = "") =>
    scopedIds === null ? "" : `AND ${qualifier}release_id IN (${scopedIds})`;
  const bottleScope =
    scopedIds === null
      ? ""
      : "AND bottle_id IN (SELECT promoted_bottle_id FROM complete_promotion)";
  const result = await tx.execute<MembershipConflictRow>(
    sql.raw(`
    WITH complete_promotion AS (
      SELECT release_id, promoted_bottle_id
      FROM bottle_release_promotion
      WHERE TRUE ${releaseScope()}
    ),
    tasting_final AS (
      SELECT
        id::text AS row_id,
        COALESCE(p.promoted_bottle_id, -t.release_id) AS final_bottle_id,
        t.created_by_id,
        t.created_at
      FROM tasting t
      LEFT JOIN complete_promotion p ON p.release_id = t.release_id
      WHERE t.release_id IS NOT NULL ${releaseScope("t.")}
      UNION ALL
      SELECT
        id::text,
        bottle_id,
        created_by_id,
        created_at
      FROM tasting
      WHERE release_id IS NULL AND bottle_id IS NOT NULL ${bottleScope}
    ),
    collection_final AS (
      SELECT
        id::text AS row_id,
        c.collection_id,
        COALESCE(p.promoted_bottle_id, -c.release_id) AS final_bottle_id
      FROM collection_bottle c
      LEFT JOIN complete_promotion p ON p.release_id = c.release_id
      WHERE c.release_id IS NOT NULL ${releaseScope("c.")}
      UNION ALL
      SELECT id::text, collection_id, bottle_id
      FROM collection_bottle
      WHERE release_id IS NULL AND bottle_id IS NOT NULL ${bottleScope}
    ),
    flight_final AS (
      SELECT
        CONCAT(f.flight_id, ':', COALESCE(f.bottle_id::text, 'null'), ':', f.release_id) AS row_id,
        f.flight_id,
        COALESCE(p.promoted_bottle_id, -f.release_id) AS final_bottle_id
      FROM flight_bottle f
      LEFT JOIN complete_promotion p ON p.release_id = f.release_id
      WHERE f.release_id IS NOT NULL ${releaseScope("f.")}
      UNION ALL
      SELECT
        CONCAT(flight_id, ':', bottle_id, ':null'),
        flight_id,
        bottle_id
      FROM flight_bottle
      WHERE release_id IS NULL AND bottle_id IS NOT NULL ${bottleScope}
    ),
    conflicts AS (
      SELECT
        'tasting'::text AS slot,
        MIN(row_id) AS row_id,
        CONCAT(final_bottle_id, ':', created_by_id, ':', created_at) AS final_key
      FROM tasting_final
      GROUP BY final_bottle_id, created_by_id, created_at
      HAVING COUNT(*) > 1
      UNION ALL
      SELECT
        'collection_bottle',
        MIN(row_id),
        CONCAT(collection_id, ':', final_bottle_id)
      FROM collection_final
      GROUP BY collection_id, final_bottle_id
      HAVING COUNT(*) > 1
      UNION ALL
      SELECT
        'flight_bottle',
        MIN(row_id),
        CONCAT(flight_id, ':', final_bottle_id)
      FROM flight_final
      GROUP BY flight_id, final_bottle_id
      HAVING COUNT(*) > 1
    )
    SELECT
      slot,
      row_id AS "rowId",
      final_key AS "finalKey"
    FROM conflicts
    ORDER BY
      CASE slot
        WHEN 'tasting' THEN 1
        WHEN 'collection_bottle' THEN 2
        ELSE 3
      END,
      row_id
    LIMIT 1
  `),
  );
  const conflict = result.rows[0];
  if (conflict) {
    throw new CatalogMigrationConsumerError(
      "membership_conflict",
      conflict.slot,
      conflict.rowId,
      { finalKey: conflict.finalKey },
    );
  }
}

async function assertLegacyPairs(
  tx: AnyTransaction,
  releaseIds?: readonly number[],
): Promise<void> {
  const result = await tx.execute<InvalidPairRow>(
    sql.raw(`
    WITH refs AS (${referencesSql(releaseIds)})
    SELECT
      refs.slot,
      refs.row_id AS "rowId",
      refs.bottle_id AS "bottleId",
      refs.release_id AS "releaseId",
      release.bottle_id AS "expectedBottleId"
    FROM refs
    LEFT JOIN bottle_release release ON release.id = refs.release_id
    WHERE release.id IS NULL
       OR refs.bottle_id IS DISTINCT FROM release.bottle_id
    ORDER BY
      array_position(
        ARRAY[${CATALOG_MIGRATION_CONSUMER_SLOTS.map((slot) => `'${slot}'`).join(",")}],
        refs.slot
      ),
      refs.row_id
    LIMIT 1
  `),
  );
  const invalid = result.rows[0];
  if (invalid) {
    throw new CatalogMigrationConsumerError(
      "invalid_pair",
      invalid.slot,
      invalid.rowId,
      {
        bottleId: invalid.bottleId,
        releaseId: invalid.releaseId,
        expectedLegacyParentBottleId: invalid.expectedBottleId,
      },
    );
  }
}

async function assertPromotionGraph(
  tx: AnyTransaction,
  releaseIds?: readonly number[],
): Promise<void> {
  const scopedIds = sqlIdList(releaseIds);
  const result = await tx.execute<InvalidPromotionRow>(
    sql.raw(`
    SELECT
      release.id AS "releaseId",
      release.bottle_id AS "parentBottleId",
      promotion.promoted_bottle_id AS "promotedBottleId",
      CASE
        WHEN promotion.release_id IS NULL
          THEN 'promotion_missing'
        WHEN promotion.promoted_bottle_id = release.bottle_id
          THEN 'promotion_matches_parent'
        WHEN parent.id IS NULL
          OR parent.group_id IS NULL
          OR parent_tombstone.bottle_id IS NOT NULL
          THEN 'parent_inactive'
        WHEN promoted.id IS NULL
          OR promoted.group_id IS NULL
          OR promoted_tombstone.bottle_id IS NOT NULL
          THEN 'promoted_inactive'
        ELSE 'group_mismatch'
      END AS reason,
      parent.group_id AS "parentGroupId",
      promoted.group_id AS "promotedGroupId"
    FROM bottle_release release
    LEFT JOIN bottle_release_promotion promotion
      ON promotion.release_id = release.id
    LEFT JOIN bottle parent ON parent.id = release.bottle_id
    LEFT JOIN bottle promoted ON promoted.id = promotion.promoted_bottle_id
    LEFT JOIN bottle_tombstone parent_tombstone
      ON parent_tombstone.bottle_id = parent.id
    LEFT JOIN bottle_tombstone promoted_tombstone
      ON promoted_tombstone.bottle_id = promoted.id
    WHERE (
      promotion.release_id IS NULL
      OR promotion.promoted_bottle_id = release.bottle_id
      OR parent.id IS NULL
      OR parent.group_id IS NULL
      OR parent_tombstone.bottle_id IS NOT NULL
      OR promoted.id IS NULL
      OR promoted.group_id IS NULL
      OR promoted_tombstone.bottle_id IS NOT NULL
      OR parent.group_id IS DISTINCT FROM promoted.group_id
    )
    ${scopedIds === null ? "" : `AND release.id IN (${scopedIds})`}
    ORDER BY release.id
    LIMIT 1
  `),
  );
  const invalid = result.rows[0];
  if (!invalid) return;

  const details = {
    releaseId: invalid.releaseId,
    legacyParentBottleId: invalid.parentBottleId,
    promotedBottleId: invalid.promotedBottleId,
    parentGroupId: invalid.parentGroupId,
    promotedGroupId: invalid.promotedGroupId,
  };
  switch (invalid.reason) {
    case "promotion_missing":
      throw new CatalogMigrationConsumerError(
        "promotion_missing",
        null,
        invalid.releaseId,
        details,
      );
    case "promotion_matches_parent":
      throw new CatalogMigrationConsumerError(
        "promotion_mismatch",
        null,
        invalid.releaseId,
        details,
      );
    case "parent_inactive":
    case "promoted_inactive":
      throw new CatalogMigrationConsumerError(
        "inactive_bottle",
        null,
        invalid.releaseId,
        { ...details, role: invalid.reason.replace("_inactive", "") },
      );
    case "group_mismatch":
      throw new CatalogMigrationConsumerError(
        "group_mismatch",
        null,
        invalid.releaseId,
        details,
      );
  }
}

function assertSameCounts(
  expected: Readonly<CatalogMigrationConsumerResult["bySlot"]>,
  actual: Readonly<CatalogMigrationConsumerResult["bySlot"]>,
  code: "mutation_count_mismatch" | "postflight_failed",
): void {
  for (const slot of CATALOG_MIGRATION_CONSUMER_SLOTS) {
    if (expected[slot] !== actual[slot]) {
      throw new CatalogMigrationConsumerError(code, slot, null, {
        expected: expected[slot],
        actual: actual[slot],
      });
    }
  }
}

async function applySlot(
  tx: AnyTransaction,
  definition: ConsumerSlotDefinition,
  releaseIds?: readonly number[],
): Promise<number> {
  const { table, bottleColumn, releaseColumn } = definition;
  const scopedIds = sqlIdList(releaseIds);
  const result = await tx.execute<{ count: number }>(
    sql.raw(`
    WITH updated AS (
      UPDATE ${table} AS consumer
      SET ${bottleColumn} = promotion.promoted_bottle_id
      FROM bottle_release AS release
      INNER JOIN bottle_release_promotion AS promotion
        ON promotion.release_id = release.id
      WHERE consumer.${releaseColumn} = release.id
        AND consumer.${bottleColumn} IS DISTINCT FROM promotion.promoted_bottle_id
        ${scopedIds === null ? "" : `AND release.id IN (${scopedIds})`}
      RETURNING 1
    )
    SELECT COUNT(*)::int AS count
    FROM updated
  `),
  );
  return firstRow(result.rows, `${definition.slot}_mutation_count`).count;
}

async function assertPromotedPairs(
  tx: AnyTransaction,
  releaseIds?: readonly number[],
): Promise<CatalogMigrationConsumerResult> {
  const result = await tx.execute<InvalidPairRow>(
    sql.raw(`
    WITH refs AS (${referencesSql(releaseIds)})
    SELECT
      refs.slot,
      refs.row_id AS "rowId",
      refs.bottle_id AS "bottleId",
      refs.release_id AS "releaseId",
      promotion.promoted_bottle_id AS "expectedBottleId"
    FROM refs
    LEFT JOIN bottle_release release ON release.id = refs.release_id
    LEFT JOIN bottle_release_promotion promotion
      ON promotion.release_id = release.id
    WHERE release.id IS NULL
       OR promotion.release_id IS NULL
       OR refs.bottle_id IS DISTINCT FROM promotion.promoted_bottle_id
    ORDER BY
      array_position(
        ARRAY[${CATALOG_MIGRATION_CONSUMER_SLOTS.map((slot) => `'${slot}'`).join(",")}],
        refs.slot
      ),
      refs.row_id
    LIMIT 1
  `),
  );
  const invalid = result.rows[0];
  if (invalid) {
    throw new CatalogMigrationConsumerError(
      "postflight_failed",
      invalid.slot,
      invalid.rowId,
      {
        bottleId: invalid.bottleId,
        releaseId: invalid.releaseId,
        expectedPromotedBottleId: invalid.expectedBottleId,
      },
    );
  }
  return await loadConsumerCounts(tx, releaseIds);
}

/**
 * Validates every retained release pair and final membership key without
 * writing. Call this after locks and audit revalidation but before family DML.
 */
export async function preflightLegacyConsumersInTransaction(
  tx: AnyTransaction,
  releaseIds?: readonly number[],
): Promise<CatalogMigrationConsumerPreflight> {
  const counts = await loadConsumerCounts(tx, releaseIds);
  await assertNoMembershipConflicts(tx, releaseIds);
  await assertLegacyPairs(tx, releaseIds);
  return Object.freeze({
    bySlot: Object.freeze({ ...counts.bySlot }),
    total: counts.total,
    [consumerPreflightBrand]: true as const,
  });
}

/**
 * Repoints all retained release-specific consumers through the durable
 * promotion table. Only Bottle-id columns change; release and target evidence
 * plus every metadata field remain untouched.
 */
export async function repointLegacyConsumersInTransaction(
  tx: AnyTransaction,
  preflight: CatalogMigrationConsumerPreflight,
  releaseIds?: readonly number[],
): Promise<CatalogMigrationConsumerResult> {
  await assertPromotionGraph(tx, releaseIds);
  const before = await loadConsumerCounts(tx, releaseIds);
  assertSameCounts(preflight.bySlot, before.bySlot, "mutation_count_mismatch");
  await assertLegacyPairs(tx, releaseIds);
  await assertNoMembershipConflicts(tx, releaseIds);

  const bySlot = emptyResult().bySlot;
  for (const definition of CONSUMER_SLOT_DEFINITIONS) {
    bySlot[definition.slot] = await applySlot(tx, definition, releaseIds);
  }
  assertSameCounts(preflight.bySlot, bySlot, "mutation_count_mismatch");

  const after = await assertPromotedPairs(tx, releaseIds);
  assertSameCounts(preflight.bySlot, after.bySlot, "postflight_failed");
  return { bySlot, total: preflight.total };
}

/**
 * Performs the already-complete path's promotion-aware consumer assertion
 * without issuing writes.
 */
export async function assertLegacyConsumersPromotedInTransaction(
  tx: AnyTransaction,
  releaseIds?: readonly number[],
): Promise<CatalogMigrationConsumerResult> {
  await assertPromotionGraph(tx, releaseIds);
  await assertNoMembershipConflicts(tx, releaseIds);
  return await assertPromotedPairs(tx, releaseIds);
}
