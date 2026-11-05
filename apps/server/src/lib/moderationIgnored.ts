import { db } from "@peated/server/db";
import {
  auctionLots,
  auctions,
  bottleChecks,
  externalReviewArticles,
  externalReviews,
  externalSites,
  incomingBottleDecisionLogs,
  storePriceMatchProposals,
  storePrices,
  users,
} from "@peated/server/db/schema";
import type { IgnoredSource } from "@peated/server/orpc/routes/admin/moderation/schemas";
import { and, sql, type AnyColumn, type SQL } from "drizzle-orm";

type IgnoredSourceInput = {
  query?: string;
  kind?: IgnoredSource["kind"];
  ignoredBy?: "automatic" | "moderator";
  offset: number;
  limit: number;
};

type IgnoredSourceRow = {
  key: string;
  kind: IgnoredSource["kind"];
  sourceId: string;
  priceId: string | null;
  title: string;
  sourceLabel: string;
  url: string | null;
  reason: string | null;
  ignoredBy: string | null;
  ignoredAt: Date | string;
};

// The latest classifier run for a source, joined LATERAL. Its reason is shown
// only when that run ignored the source; an older run's reason no longer
// explains the state.
function latestCheck(sourceKind: string, sourceId: SQL) {
  return sql`LATERAL (
    SELECT
      latest.output->>'status' AS status,
      CASE
        WHEN latest.output->>'status' = 'ignored' THEN latest.output->>'reason'
      END AS reason,
      latest.created_at
    FROM ${bottleChecks} AS latest
    WHERE latest.intent = 'resolve_reference'
      AND latest.source_kind = ${sourceKind}
      AND latest.source_id = ${sourceId}
    ORDER BY latest.created_at DESC, latest.id DESC
    LIMIT 1
  )`;
}

// A moderator's latest ignore decision for a source, joined LATERAL, for the
// reason they gave.
function latestIgnoreDecision(sourceKind: string, sourceId: SQL | AnyColumn) {
  return sql`LATERAL (
    SELECT decision.rationale
    FROM ${incomingBottleDecisionLogs} AS decision
    WHERE decision.source_kind = ${sourceKind}
      AND decision.source_id = ${sourceId}
      AND decision.decision = 'ignore'
    ORDER BY decision.id DESC
    LIMIT 1
  )`;
}

/**
 * Lists sources that are ignored now, newest first, so moderators can sample
 * wrong ignores. Each source owns its ignored state: a listing's proposal
 * status, an auction lot's match status, and, for a review, an unresolved
 * review whose latest check ignored it. A source with no reviewer was ignored
 * automatically.
 */
export async function queryIgnoredSources(
  input: IgnoredSourceInput,
): Promise<IgnoredSource[]> {
  const conditions: SQL<unknown>[] = [];
  if (input.kind) conditions.push(sql`ignored.kind = ${input.kind}`);
  if (input.ignoredBy === "automatic")
    conditions.push(sql`ignored."ignoredBy" IS NULL`);
  if (input.ignoredBy === "moderator")
    conditions.push(sql`ignored."ignoredBy" IS NOT NULL`);
  if (input.query) {
    conditions.push(sql`
      STRPOS(
        LOWER(CONCAT_WS(' ', ignored.title, ignored."sourceLabel", ignored.reason, ignored.key)),
        LOWER(${input.query})
      ) > 0
    `);
  }
  const where = and(...conditions) ?? sql`TRUE`;

  const result = await db.execute<IgnoredSourceRow>(sql`
    SELECT *
    FROM (
      SELECT
        'listing:' || ${storePriceMatchProposals.id} AS key,
        'listing'::text AS kind,
        ${storePriceMatchProposals.id}::text AS "sourceId",
        ${storePrices.id}::text AS "priceId",
        ${storePrices.name} AS title,
        ${externalSites.name} AS "sourceLabel",
        ${storePrices.url} AS url,
        CASE
          WHEN ${users.id} IS NULL THEN listing_check.reason
          ELSE listing_decision.rationale
        END AS reason,
        ${users.username} AS "ignoredBy",
        COALESCE(
          ${storePriceMatchProposals.reviewedAt},
          CASE WHEN listing_check.status = 'ignored' THEN listing_check.created_at END,
          ${storePriceMatchProposals.updatedAt}
        ) AS "ignoredAt"
      FROM ${storePriceMatchProposals}
      INNER JOIN ${storePrices}
        ON ${storePrices.id} = ${storePriceMatchProposals.priceId}
      INNER JOIN ${externalSites}
        ON ${externalSites.id} = ${storePrices.externalSiteId}
      LEFT JOIN ${users} ON ${users.id} = ${storePriceMatchProposals.reviewedById}
      LEFT JOIN ${latestCheck("store_price", sql`${storePrices.id}::text`)} AS listing_check ON TRUE
      LEFT JOIN ${latestIgnoreDecision("store_price", storePrices.id)} AS listing_decision ON TRUE
      WHERE ${storePriceMatchProposals.status} = 'ignored'
        AND ${storePrices.hidden} = false

      UNION ALL

      SELECT
        'auction_lot:' || ${auctionLots.id} AS key,
        'auction_lot'::text AS kind,
        ${auctionLots.id}::text AS "sourceId",
        NULL AS "priceId",
        ${auctionLots.name} AS title,
        ${externalSites.name} AS "sourceLabel",
        ${auctionLots.url} AS url,
        -- A saved check that ignored the lot means the classifier did; a
        -- moderator can only ignore a lot that is not ignored yet.
        CASE
          WHEN lot_check.output->>'status' = 'ignored' THEN lot_check.output->>'reason'
          ELSE lot_decision.rationale
        END AS reason,
        CASE
          WHEN lot_check.output->>'status' = 'ignored' THEN NULL
          ELSE ${users.username}
        END AS "ignoredBy",
        CASE
          WHEN lot_check.output->>'status' = 'ignored'
            THEN COALESCE(lot_check.completed_at, lot_check.created_at)
          ELSE COALESCE(${auctionLots.matchedAt}, ${auctionLots.firstSeenAt})
        END AS "ignoredAt"
      FROM ${auctionLots}
      INNER JOIN ${auctions} ON ${auctions.id} = ${auctionLots.auctionId}
      INNER JOIN ${externalSites} ON ${externalSites.id} = ${auctions.externalSiteId}
      LEFT JOIN ${bottleChecks} AS lot_check ON lot_check.id = ${auctionLots.matchCheckId}
      LEFT JOIN ${users} ON ${users.id} = ${auctionLots.matchedById}
      LEFT JOIN ${latestIgnoreDecision("auction_lot", auctionLots.id)} AS lot_decision ON TRUE
      WHERE ${auctionLots.matchStatus} = 'ignored'

      UNION ALL

      SELECT
        'external_review:' || ${externalReviews.id} AS key,
        'external_review'::text AS kind,
        ${externalReviews.id}::text AS "sourceId",
        NULL AS "priceId",
        ${externalReviews.name} AS title,
        ${externalSites.name} AS "sourceLabel",
        ${externalReviewArticles.canonicalUrl} AS url,
        review_check.reason AS reason,
        NULL AS "ignoredBy",
        review_check.created_at AS "ignoredAt"
      FROM ${externalReviews}
      INNER JOIN ${externalReviewArticles}
        ON ${externalReviewArticles.id} = ${externalReviews.articleId}
      INNER JOIN ${externalSites}
        ON ${externalSites.id} = ${externalReviewArticles.externalSiteId}
      INNER JOIN ${latestCheck("review", sql`${externalReviews.id}::text`)} AS review_check ON review_check.status = 'ignored'
      WHERE ${externalReviews.bottleId} IS NULL
        AND ${externalReviews.removedAt} IS NULL
        AND ${externalReviews.bottleNoMatchAt} IS NOT NULL
    ) AS ignored
    WHERE ${where}
    ORDER BY ignored."ignoredAt" DESC, ignored.key ASC
    OFFSET ${input.offset}
    LIMIT ${input.limit}
  `);

  return result.rows.map((row) => ({
    key: row.key,
    kind: row.kind,
    source:
      row.kind === "listing"
        ? {
            kind: "listing",
            proposalId: Number(row.sourceId),
            priceId: Number(row.priceId),
          }
        : row.kind === "auction_lot"
          ? { kind: "auction_lot", lotId: Number(row.sourceId) }
          : { kind: "external_review", reviewId: Number(row.sourceId) },
    title: row.title,
    sourceLabel: row.sourceLabel,
    url: row.url,
    reason: row.reason,
    ignoredBy: row.ignoredBy,
    ignoredAt: new Date(row.ignoredAt).toISOString(),
  }));
}
