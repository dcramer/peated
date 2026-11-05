import { db } from "@peated/server/db";
import {
  bottleChecks,
  externalReviews,
  type ExternalReview,
} from "@peated/server/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

export const ExternalReviewResolutionVersionSchema = z
  .object({
    name: z.string().min(1),
    attemptedAt: z.string().datetime(),
  })
  .strict();

export function reviewResolutionVersionMatches(
  review: ExternalReview,
  expected: z.infer<typeof ExternalReviewResolutionVersionSchema>,
) {
  return (
    review.bottleId === null &&
    review.removedAt === null &&
    review.name === expected.name &&
    review.bottleNoMatchAt?.getTime() ===
      new Date(expected.attemptedAt).getTime()
  );
}

/**
 * Review matching rule (owner: external reviews): an unresolved review is
 * ignored when its latest saved check ignored it. Reviews keep no ignored
 * state of their own, so the Inbox and the ignored list both read this.
 */
export function latestReviewCheckIgnoredCondition() {
  return sql`COALESCE((
    SELECT latest.output->>'status'
    FROM ${bottleChecks} AS latest
    WHERE latest.intent = 'resolve_reference'
      AND latest.source_kind = 'review'
      AND latest.source_id = ${externalReviews.id}::text
    ORDER BY latest.created_at DESC, latest.id DESC
    LIMIT 1
  ), '') = 'ignored'`;
}

// Review matching versions use the milliseconds exposed by JavaScript and the API.
// PostgreSQL can retain extra precision from older attempts written with NOW().
export function reviewResolutionAttemptCondition(attemptedAt: Date | null) {
  return attemptedAt === null
    ? isNull(externalReviews.bottleNoMatchAt)
    : sql`date_trunc('milliseconds', ${externalReviews.bottleNoMatchAt}) = ${attemptedAt.toISOString()}::timestamp`;
}

export async function getLatestReviewBottleCheck(reviewId: number) {
  return await db.query.bottleChecks.findFirst({
    where: and(
      eq(bottleChecks.intent, "resolve_reference"),
      eq(bottleChecks.sourceKind, "review"),
      eq(bottleChecks.sourceId, String(reviewId)),
    ),
    orderBy: [desc(bottleChecks.createdAt), desc(bottleChecks.id)],
  });
}
