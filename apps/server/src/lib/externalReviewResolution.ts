import { db } from "@peated/server/db";
import { bottleChecks, type ExternalReview } from "@peated/server/db/schema";
import { and, desc, eq } from "drizzle-orm";
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
