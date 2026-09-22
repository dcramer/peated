import { db } from "@peated/server/db";
import {
  actors,
  bottleChecks,
  bottleOperations,
  bottles,
  bottleSeries,
  entities,
  flights,
  incomingBottleDecisionLogs,
  reports,
  users,
} from "@peated/server/db/schema";
import type { ModerationHistorySummary } from "@peated/server/orpc/routes/admin/moderation/schemas";
import { and, isNotNull, sql, type SQL } from "drizzle-orm";

type ModerationHistoryInput = {
  query?: string;
  category?: "listing" | "catalog" | "community";
  outcome?: string;
  actor?: string;
  offset: number;
  limit: number;
};

type ModerationHistoryRow = Omit<ModerationHistorySummary, "occurredAt"> & {
  occurredAt: Date | string;
};

export async function queryModerationHistory(
  input: ModerationHistoryInput,
): Promise<ModerationHistorySummary[]> {
  const conditions: SQL<unknown>[] = [];
  if (input.category) {
    conditions.push(sql`history.category = ${input.category}`);
  }
  if (input.outcome) {
    conditions.push(
      sql`STRPOS(LOWER(history.outcome), LOWER(${input.outcome})) > 0`,
    );
  }
  if (input.actor) {
    conditions.push(
      sql`STRPOS(LOWER(history.actor), LOWER(${input.actor})) > 0`,
    );
  }
  if (input.query) {
    conditions.push(sql`
      STRPOS(
        LOWER(CONCAT_WS(' ', history.title, history.outcome, history.actor, history.key)),
        LOWER(${input.query})
      ) > 0
    `);
  }
  const where = and(...conditions) ?? sql`TRUE`;

  const result = await db.execute<ModerationHistoryRow>(sql`
    SELECT *
    FROM (
      SELECT
        'incoming:' || ${incomingBottleDecisionLogs.id} AS key,
        'incoming_decision'::text AS kind,
        'listing'::text AS category,
        ${incomingBottleDecisionLogs.name} AS title,
        REPLACE(${incomingBottleDecisionLogs.decision}::text, '_', ' ') AS outcome,
        ${actors.displayName} AS actor,
        ${incomingBottleDecisionLogs.createdAt} AS "occurredAt"
      FROM ${incomingBottleDecisionLogs}
      INNER JOIN ${actors}
        ON ${actors.id} = ${incomingBottleDecisionLogs.actorId}

      UNION ALL

      SELECT
        'operation:' || ${bottleOperations.id} AS key,
        'operation'::text AS kind,
        'catalog'::text AS category,
        CASE ${bottleOperations.proposal}->>'type'
          WHEN 'update_bottle' THEN
            CONCAT(
              'Update bottle #',
              ${bottleOperations.proposal}#>>'{input,bottleId}'
            )
          WHEN 'merge_bottles' THEN
            CONCAT(
              'Merge bottle #',
              ${bottleOperations.proposal}#>>'{input,sourceBottleId}',
              ' into #',
              ${bottleOperations.proposal}#>>'{input,destinationBottleId}'
            )
          WHEN 'update_entity' THEN
            CONCAT(
              'Update brand or producer #',
              ${bottleOperations.proposal}#>>'{input,entityId}'
            )
          WHEN 'merge_entities' THEN
            CONCAT(
              'Merge brand or producer #',
              ${bottleOperations.proposal}#>>'{input,sourceEntityId}',
              ' into #',
              ${bottleOperations.proposal}#>>'{input,destinationEntityId}'
            )
          ELSE 'Operation #' || ${bottleOperations.id}
        END AS title,
        REPLACE(${bottleOperations.status}::text, '_', ' ') AS outcome,
        ${users.username} AS actor,
        ${bottleOperations.reviewedAt} AS "occurredAt"
      FROM ${bottleOperations}
      LEFT JOIN ${users} ON ${users.id} = ${bottleOperations.reviewedById}
      WHERE ${isNotNull(bottleOperations.reviewedAt)}

      UNION ALL

      SELECT
        'closure:' || ${bottleChecks.id} AS key,
        'audit_closure'::text AS kind,
        'catalog'::text AS category,
        CASE
          WHEN ${bottleChecks.bottleId} IS NOT NULL
            THEN 'Bottle #' || ${bottleChecks.bottleId}
          ELSE 'Check #' || ${bottleChecks.id}
        END AS title,
        COALESCE(REPLACE(${bottleChecks.closeReason}::text, '_', ' '), 'closed') AS outcome,
        ${users.username} AS actor,
        ${bottleChecks.closedAt} AS "occurredAt"
      FROM ${bottleChecks}
      LEFT JOIN ${users} ON ${users.id} = ${bottleChecks.closedById}
      WHERE ${isNotNull(bottleChecks.closedAt)}

      UNION ALL

      SELECT
        'report:' || ${reports.id} AS key,
        'report'::text AS kind,
        'community'::text AS category,
        -- Mirrors describeReportSubject in lib/reports.ts.
        CASE ${reports.objectType}::text
          WHEN 'tasting' THEN 'Tasting ' || COALESCE('by @' || reported_user.username, '#' || ${reports.objectId})
          WHEN 'member_review' THEN 'Review ' || COALESCE('by @' || reported_user.username, '#' || ${reports.objectId})
          WHEN 'comment' THEN 'Comment ' || COALESCE('by @' || reported_user.username, '#' || ${reports.objectId})
          WHEN 'user' THEN 'Member ' || COALESCE('@' || reported_user.username, '#' || ${reports.objectId})
          WHEN 'bottle' THEN COALESCE('Bottle: ' || ${bottles.fullName}, 'Bottle #' || ${reports.objectId})
          WHEN 'entity' THEN COALESCE('Entity: ' || ${entities.name}, 'Entity #' || ${reports.objectId})
          WHEN 'bottle_series' THEN COALESCE('Series: ' || ${bottleSeries.fullName}, 'Series #' || ${reports.objectId})
          WHEN 'flight' THEN COALESCE('Flight: ' || ${flights.name}, 'Flight #' || ${reports.objectId})
          ELSE 'Report #' || ${reports.id}
        END AS title,
        ${reports.status}::text AS outcome,
        ${users.username} AS actor,
        ${reports.closedAt} AS "occurredAt"
      FROM ${reports}
      LEFT JOIN ${users} AS reported_user
        ON reported_user.id = ${reports.reportedUserId}
      LEFT JOIN ${bottles}
        ON ${reports.objectType} = 'bottle' AND ${bottles.id} = ${reports.objectId}
      LEFT JOIN ${entities}
        ON ${reports.objectType} = 'entity' AND ${entities.id} = ${reports.objectId}
      LEFT JOIN ${bottleSeries}
        ON ${reports.objectType} = 'bottle_series' AND ${bottleSeries.id} = ${reports.objectId}
      LEFT JOIN ${flights}
        ON ${reports.objectType} = 'flight' AND ${flights.id} = ${reports.objectId}
      LEFT JOIN ${users} ON ${users.id} = ${reports.closedById}
      WHERE ${isNotNull(reports.closedAt)}
    ) AS history
    WHERE ${where}
    ORDER BY history."occurredAt" DESC, history.key ASC
    OFFSET ${input.offset}
    LIMIT ${input.limit}
  `);

  return result.rows.map((row) => ({
    ...row,
    occurredAt: new Date(row.occurredAt).toISOString(),
  }));
}
