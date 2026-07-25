import { sql } from "drizzle-orm";
import { db, type AnyConnection, type AnyDatabase } from "../db";
import {
  CATALOG_MIGRATION_AUDIT_SCHEMA_VERSION,
  CatalogMigrationAuditSchema,
  type CatalogMigrationAudit,
  type CatalogMigrationCollision,
  type CatalogMigrationLegacySummary,
  type CatalogMigrationMappingSummary,
  type CatalogMigrationReferenceSummary,
} from "../schemas/catalogMigrationAudit";

type PromotionMappingRow = {
  releaseId: number;
  promotedBottleId: number | null;
  status: string;
  completedAt: Date | null;
  error: string | null;
  legacyReleaseExists: boolean;
  promotedBottleExists: boolean;
};

function firstRow<T>(result: { rows: T[] }, queryName: string): T {
  const row = result.rows[0];
  if (!row)
    throw new Error(`Catalog migration audit ${queryName} returned no rows.`);
  return row;
}

export function summarizePromotionMappings({
  tablePresent,
  totalLegacyReleases,
  rows,
}: {
  tablePresent: boolean;
  totalLegacyReleases: number;
  rows: PromotionMappingRow[];
}): CatalogMigrationMappingSummary {
  const releaseCounts = new Map<number, number>();
  const completedReleaseIds = new Set<number>();
  let completedMappings = 0;
  let pendingMappings = 0;
  let failedMappings = 0;
  let partialMappings = 0;
  let invalidStatusMappings = 0;

  for (const row of rows) {
    releaseCounts.set(
      row.releaseId,
      (releaseCounts.get(row.releaseId) ?? 0) + 1,
    );

    const isComplete =
      row.status === "promoted" &&
      row.promotedBottleId !== null &&
      row.completedAt !== null &&
      row.error === null &&
      row.legacyReleaseExists &&
      row.promotedBottleExists;
    if (isComplete) {
      completedMappings += 1;
      completedReleaseIds.add(row.releaseId);
    } else if (row.status === "pending") {
      pendingMappings += 1;
    } else if (row.status === "failed") {
      failedMappings += 1;
    } else if (row.status === "promoted") {
      partialMappings += 1;
    } else {
      invalidStatusMappings += 1;
    }
  }

  const mappedReleases = completedReleaseIds.size;
  return {
    tablePresent,
    totalLegacyReleases,
    totalMappings: rows.length,
    mappedReleases,
    unmappedReleases: Math.max(totalLegacyReleases - mappedReleases, 0),
    completedMappings,
    pendingMappings,
    failedMappings,
    partialMappings,
    invalidStatusMappings,
    duplicateReleaseMappings: Array.from(releaseCounts.values()).filter(
      (count) => count > 1,
    ).length,
    missingLegacyReleases: rows.filter((row) => !row.legacyReleaseExists)
      .length,
    missingPromotedBottles: rows.filter((row) => !row.promotedBottleExists)
      .length,
  };
}

async function loadLegacyCatalogSummary(
  database: AnyDatabase,
): Promise<CatalogMigrationLegacySummary> {
  const result = await database.execute<{
    report: CatalogMigrationLegacySummary;
  }>(sql`
    WITH release_counts AS (
      SELECT bottle_id, COUNT(*)::int AS release_count
      FROM bottle_release
      GROUP BY bottle_id
    )
    SELECT json_build_object(
      'totalParents', COUNT(*)::int,
      'parentsWithZeroReleases', COUNT(*) FILTER (WHERE COALESCE(rc.release_count, 0) = 0)::int,
      'parentsWithOneRelease', COUNT(*) FILTER (WHERE rc.release_count = 1)::int,
      'parentsWithMultipleReleases', COUNT(*) FILTER (WHERE rc.release_count > 1)::int,
      'totalReleases', (SELECT COUNT(*)::int FROM bottle_release),
      'parentsWithReleaseLikeFields', COUNT(*) FILTER (
        WHERE COALESCE(rc.release_count, 0) > 0
          AND (
            b.edition IS NOT NULL OR b.vintage_year IS NOT NULL OR
            b.release_year IS NOT NULL OR b.abv IS NOT NULL OR
            b.single_cask IS NOT NULL OR b.cask_strength IS NOT NULL OR
            b.cask_size IS NOT NULL OR b.cask_type IS NOT NULL OR
            b.cask_fill IS NOT NULL
          )
      )::int,
      'childParentAgeConflicts', (
        SELECT COUNT(*)::int
        FROM bottle_release r
        INNER JOIN bottle parent ON parent.id = r.bottle_id
        WHERE parent.stated_age IS NOT NULL
          AND r.stated_age IS NOT NULL
          AND parent.stated_age <> r.stated_age
      ),
      'orphanReleases', (
        SELECT COUNT(*)::int
        FROM bottle_release r
        LEFT JOIN bottle parent ON parent.id = r.bottle_id
        WHERE parent.id IS NULL
      ),
      'missingParentCreators', COUNT(*) FILTER (WHERE parent_actor.id IS NULL)::int,
      'missingReleaseCreators', (
        SELECT COUNT(*)::int
        FROM bottle_release r
        LEFT JOIN actor release_actor ON release_actor.id = r.created_by_actor_id
        WHERE release_actor.id IS NULL
      ),
      'missingParentAliases', COUNT(*) FILTER (
        WHERE NOT EXISTS (
          SELECT 1 FROM bottle_alias a
          WHERE a.bottle_id = b.id AND a.release_id IS NULL AND NOT COALESCE(a.ignored, false)
        )
      )::int,
      'missingReleaseAliases', (
        SELECT COUNT(*)::int
        FROM bottle_release r
        WHERE NOT EXISTS (
          SELECT 1 FROM bottle_alias a
          WHERE a.release_id = r.id AND NOT COALESCE(a.ignored, false)
        )
      ),
      'missingParentImages', COUNT(*) FILTER (
        WHERE b.image_url IS NULL OR BTRIM(b.image_url) = ''
      )::int,
      'missingReleaseImages', (
        SELECT COUNT(*)::int
        FROM bottle_release r
        WHERE r.image_url IS NULL OR BTRIM(r.image_url) = ''
      )
    ) AS report
    FROM bottle b
    LEFT JOIN release_counts rc ON rc.bottle_id = b.id
    LEFT JOIN actor parent_actor ON parent_actor.id = b.created_by_actor_id
  `);

  return firstRow(result, "legacy catalog summary").report;
}

async function loadReferenceSummaries(
  database: AnyDatabase,
): Promise<CatalogMigrationReferenceSummary[]> {
  const result = await database.execute<CatalogMigrationReferenceSummary>(sql`
    WITH surfaces(surface) AS (
      VALUES
        ('tastings'),
        ('reviews'),
        ('collections'),
        ('flights'),
        ('prices'),
        ('aliases'),
        ('observations'),
        ('decision_logs'),
        ('proposals_current'),
        ('proposals_suggested'),
        ('proposal_attempts_current'),
        ('proposal_attempts_suggested')
    ), reference_rows AS (
      SELECT 'tastings'::text AS surface, bottle_id, release_id FROM tasting
      UNION ALL SELECT 'reviews', bottle_id, release_id FROM review
      UNION ALL SELECT 'collections', bottle_id, release_id FROM collection_bottle
      UNION ALL SELECT 'flights', bottle_id, release_id FROM flight_bottle
      UNION ALL SELECT 'prices', bottle_id, release_id FROM store_price
      UNION ALL SELECT 'aliases', bottle_id, release_id FROM bottle_alias
      UNION ALL SELECT 'observations', bottle_id, release_id FROM bottle_observation
      UNION ALL SELECT 'decision_logs', bottle_id, release_id FROM incoming_bottle_decision_log
      UNION ALL SELECT 'proposals_current', current_bottle_id, current_release_id FROM store_price_match_proposal
      UNION ALL SELECT 'proposals_suggested', suggested_bottle_id, suggested_release_id FROM store_price_match_proposal
      UNION ALL SELECT 'proposal_attempts_current', current_bottle_id, current_release_id FROM store_price_match_attempt
      UNION ALL SELECT 'proposal_attempts_suggested', suggested_bottle_id, suggested_release_id FROM store_price_match_attempt
    )
    SELECT
      surfaces.surface AS "surface",
      COUNT(refs.surface)::int AS "totalRows",
      COUNT(*) FILTER (WHERE refs.bottle_id IS NOT NULL AND refs.release_id IS NULL)::int AS "genericRows",
      COUNT(*) FILTER (WHERE refs.release_id IS NOT NULL)::int AS "releaseRows",
      COUNT(*) FILTER (
        WHERE refs.surface IS NOT NULL
          AND refs.bottle_id IS NULL
          AND refs.release_id IS NULL
      )::int AS "unassignedRows",
      COUNT(*) FILTER (WHERE refs.bottle_id IS NOT NULL AND b.id IS NULL)::int AS "missingBottleReferences",
      COUNT(*) FILTER (WHERE refs.release_id IS NOT NULL AND r.id IS NULL)::int AS "missingReleaseReferences",
      COUNT(*) FILTER (
        WHERE refs.release_id IS NOT NULL
          AND (refs.bottle_id IS NULL OR r.bottle_id IS DISTINCT FROM refs.bottle_id)
      )::int AS "mismatchedPairs",
      COUNT(*) FILTER (
        WHERE (refs.bottle_id IS NOT NULL AND b.id IS NULL)
          OR (refs.release_id IS NOT NULL AND r.id IS NULL)
          OR (
            refs.release_id IS NOT NULL
            AND (refs.bottle_id IS NULL OR r.bottle_id IS DISTINCT FROM refs.bottle_id)
          )
      )::int AS "invalidRows"
    FROM surfaces
    LEFT JOIN reference_rows refs ON refs.surface = surfaces.surface
    LEFT JOIN bottle b ON b.id = refs.bottle_id
    LEFT JOIN bottle_release r ON r.id = refs.release_id
    GROUP BY surfaces.surface
    ORDER BY surfaces.surface
  `);

  return result.rows;
}

async function loadCollisions(
  database: AnyDatabase,
  promotionTablePresent: boolean,
): Promise<CatalogMigrationCollision[]> {
  const validPromotions = promotionTablePresent
    ? sql`
        SELECT mapping.release_id, mapping.promoted_bottle_id
        FROM bottle_release_promotion mapping
        INNER JOIN bottle_release release ON release.id = mapping.release_id
        INNER JOIN bottle promoted ON promoted.id = mapping.promoted_bottle_id
        WHERE mapping.status = 'promoted'
          AND mapping.completed_at IS NOT NULL
          AND mapping.error IS NULL
      `
    : sql`
        SELECT NULL::bigint AS release_id, NULL::bigint AS promoted_bottle_id
        WHERE FALSE
      `;
  const result = await database.execute<CatalogMigrationCollision>(sql`
    WITH valid_promotions AS (${validPromotions})
    SELECT
      collision_type AS "type",
      collision_name AS "name",
      release_id::int AS "releaseId",
      other_release_id::int AS "otherReleaseId",
      bottle_id::int AS "bottleId"
    FROM (
      SELECT
        'release_full_name_vs_bottle'::text AS collision_type,
        r.full_name AS collision_name,
        r.id AS release_id,
        NULL::bigint AS other_release_id,
        b.id AS bottle_id
      FROM bottle_release r
      INNER JOIN bottle b ON LOWER(b.full_name) = LOWER(r.full_name)
      LEFT JOIN valid_promotions promotion
        ON promotion.release_id = r.id
        AND promotion.promoted_bottle_id = b.id
      WHERE promotion.release_id IS NULL

      UNION ALL

      SELECT
        'release_full_name_vs_alias',
        r.full_name,
        r.id,
        NULL::bigint,
        a.bottle_id
      FROM bottle_release r
      INNER JOIN bottle_alias a ON LOWER(a.name) = LOWER(r.full_name)
      LEFT JOIN valid_promotions promotion
        ON promotion.release_id = r.id
        AND promotion.promoted_bottle_id = a.bottle_id
      WHERE a.release_id IS DISTINCT FROM r.id
        AND NOT COALESCE(a.ignored, false)
        AND promotion.release_id IS NULL

      UNION ALL

      SELECT
        'release_alias_vs_bottle',
        a.name,
        r.id,
        NULL::bigint,
        b.id
      FROM bottle_alias a
      INNER JOIN bottle_release r ON r.id = a.release_id
      INNER JOIN bottle b ON LOWER(b.full_name) = LOWER(a.name)
      WHERE NOT COALESCE(a.ignored, false)

      UNION ALL

      SELECT
        'release_full_name_case_duplicate',
        left_release.full_name,
        left_release.id,
        right_release.id,
        NULL::bigint
      FROM bottle_release left_release
      INNER JOIN bottle_release right_release
        ON LOWER(left_release.full_name) = LOWER(right_release.full_name)
        AND left_release.id < right_release.id
    ) collisions
    ORDER BY collision_type, LOWER(collision_name), release_id
  `);

  return result.rows;
}

async function loadPromotionMappingSummary({
  database,
  totalLegacyReleases,
}: {
  database: AnyDatabase;
  totalLegacyReleases: number;
}): Promise<CatalogMigrationMappingSummary> {
  const presenceResult = await database.execute<{ tablePresent: boolean }>(sql`
    SELECT to_regclass('public.bottle_release_promotion') IS NOT NULL AS "tablePresent"
  `);
  const tablePresent = firstRow(
    presenceResult,
    "mapping table check",
  ).tablePresent;
  if (!tablePresent) {
    return summarizePromotionMappings({
      tablePresent: false,
      totalLegacyReleases,
      rows: [],
    });
  }

  const mappingResult = await database.execute<PromotionMappingRow>(sql`
    SELECT
      mapping.release_id::int AS "releaseId",
      mapping.promoted_bottle_id::int AS "promotedBottleId",
      mapping.status::text AS "status",
      mapping.completed_at AS "completedAt",
      mapping.error AS "error",
      release.id IS NOT NULL AS "legacyReleaseExists",
      promoted.id IS NOT NULL AS "promotedBottleExists"
    FROM bottle_release_promotion mapping
    LEFT JOIN bottle_release release ON release.id = mapping.release_id
    LEFT JOIN bottle promoted ON promoted.id = mapping.promoted_bottle_id
  `);

  return summarizePromotionMappings({
    tablePresent: true,
    totalLegacyReleases,
    rows: mappingResult.rows,
  });
}

/** Runs the migration preflight in a database-enforced read-only transaction. */
export async function runCatalogMigrationAudit(
  database: AnyConnection = db,
): Promise<CatalogMigrationAudit> {
  return await database.transaction(async (tx) => {
    await tx.execute(
      sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`,
    );

    const databaseResult = await tx.execute<{ databaseName: string }>(sql`
      SELECT current_database() AS "databaseName"
    `);
    const legacyCatalog = await loadLegacyCatalogSummary(tx);
    const references = await loadReferenceSummaries(tx);
    const promotionMappings = await loadPromotionMappingSummary({
      database: tx,
      totalLegacyReleases: legacyCatalog.totalReleases,
    });
    const collisions = await loadCollisions(tx, promotionMappings.tablePresent);

    const invalidReferenceCount = references.reduce(
      (total, reference) => total + reference.invalidRows,
      0,
    );
    const blockingIssueCount =
      legacyCatalog.parentsWithReleaseLikeFields +
      legacyCatalog.childParentAgeConflicts +
      legacyCatalog.orphanReleases +
      legacyCatalog.missingParentCreators +
      legacyCatalog.missingReleaseCreators +
      invalidReferenceCount +
      collisions.length +
      promotionMappings.duplicateReleaseMappings +
      promotionMappings.pendingMappings +
      promotionMappings.failedMappings +
      promotionMappings.partialMappings +
      promotionMappings.invalidStatusMappings;
    const warningCount =
      legacyCatalog.missingParentAliases +
      legacyCatalog.missingReleaseAliases +
      legacyCatalog.missingParentImages +
      legacyCatalog.missingReleaseImages;

    return CatalogMigrationAuditSchema.parse({
      schemaVersion: CATALOG_MIGRATION_AUDIT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      databaseName: firstRow(databaseResult, "database identity").databaseName,
      legacyCatalog,
      references,
      collisions: {
        count: collisions.length,
        items: collisions,
      },
      promotionMappings,
      blockingIssueCount,
      warningCount,
    });
  });
}

export function formatCatalogMigrationAudit(
  report: CatalogMigrationAudit,
): string {
  const catalog = report.legacyCatalog;
  const lines = [
    `Catalog migration audit v${report.schemaVersion}`,
    `Database: ${report.databaseName}`,
    `Generated: ${report.generatedAt}`,
    "",
    "Legacy catalog",
    `  Parents: ${catalog.totalParents} (${catalog.parentsWithZeroReleases} zero / ${catalog.parentsWithOneRelease} one / ${catalog.parentsWithMultipleReleases} multiple releases)`,
    `  Releases: ${catalog.totalReleases}`,
    `  Parent release-like fields: ${catalog.parentsWithReleaseLikeFields}`,
    `  Parent/child age conflicts: ${catalog.childParentAgeConflicts}`,
    `  Orphan releases: ${catalog.orphanReleases}`,
    `  Missing creators: ${catalog.missingParentCreators} parents / ${catalog.missingReleaseCreators} releases`,
    `  Missing aliases: ${catalog.missingParentAliases} parents / ${catalog.missingReleaseAliases} releases`,
    `  Missing images: ${catalog.missingParentImages} parents / ${catalog.missingReleaseImages} releases`,
    "",
    "Paired references",
    ...report.references.map(
      (reference) =>
        `  ${reference.surface}: ${reference.totalRows} rows, ${reference.releaseRows} release, ${reference.genericRows} generic, ${reference.invalidRows} invalid`,
    ),
    "",
    `Promotion collisions: ${report.collisions.count}`,
    ...report.collisions.items.map(
      (collision) =>
        `  ${collision.type}: release ${collision.releaseId} (${collision.name})${collision.bottleId ? ` vs bottle ${collision.bottleId}` : ""}${collision.otherReleaseId ? ` vs release ${collision.otherReleaseId}` : ""}`,
    ),
    "",
    `Promotion mappings: ${report.promotionMappings.tablePresent ? "present" : "not created"} (${report.promotionMappings.mappedReleases}/${report.promotionMappings.totalLegacyReleases} completed; ${report.promotionMappings.pendingMappings} pending / ${report.promotionMappings.failedMappings} failed / ${report.promotionMappings.partialMappings} partial / ${report.promotionMappings.invalidStatusMappings} invalid status)`,
    `Blocking issues: ${report.blockingIssueCount}`,
    `Warnings: ${report.warningCount}`,
  ];

  return lines.join("\n");
}
