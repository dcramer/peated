import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import { bottles, reviews } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import {
  assignBottleAliasInTransaction,
  finalizeBottleAliasAssignment,
  StaleBottleAliasReviewIdentityError,
} from "@peated/server/lib/bottleAliases";
import { resolveBottleReferenceTarget } from "@peated/server/lib/bottleReferenceResolution";
import { and, eq, ne } from "drizzle-orm";

export type FixBadReviewEntitiesResult = {
  scanned: number;
  reassigned: number;
  unresolved: number;
  errored: number;
  unchanged: number;
};

/**
 * Re-resolve reviews whose linked bottle no longer matches the review title.
 *
 * This stays intentionally conservative: it never rewrites or deletes the
 * current bottle record. It only reassigns the review when an exact alias or
 * reviewed classifier result returns a replacement Bottle.
 */
export async function fixBadReviewEntities({
  user,
}: {
  user: User;
}): Promise<FixBadReviewEntitiesResult> {
  const actor = await getUserActor(user);
  const results = await db
    .select({ bottle: bottles, review: reviews })
    .from(bottles)
    .innerJoin(
      reviews,
      and(eq(reviews.bottleId, bottles.id), ne(reviews.name, bottles.fullName)),
    );

  const summary: FixBadReviewEntitiesResult = {
    scanned: 0,
    reassigned: 0,
    unresolved: 0,
    errored: 0,
    unchanged: 0,
  };

  for (const { bottle, review } of results) {
    if (review.name.startsWith(bottle.fullName)) {
      continue;
    }

    summary.scanned += 1;

    const resolution = await resolveBottleReferenceTarget({
      reference: {
        id: review.id,
        externalSiteId: review.externalSiteId,
        name: review.name,
        url: review.url,
        imageUrl: null,
        currentBottleId: review.bottleId,
        currentReleaseId: review.releaseId,
      },
      // Normalized fallback aliases can erase release markers before the
      // classifier sees the real reference title.
      aliasLookupNames: [review.name],
      createdByActorId: actor.id,
      user,
    });

    const resolvedAssignment = resolution.assignment;
    const targetBottleId = resolvedAssignment?.bottleId ?? null;
    if (!targetBottleId) {
      if (resolution.error) {
        summary.errored += 1;
        continue;
      }

      summary.unresolved += 1;
      continue;
    }

    const isSameTarget = targetBottleId === review.bottleId;

    try {
      const aliasAssignment = await db.transaction(async (tx) => {
        const assignment = resolution.assignment;
        if (!assignment) {
          throw new Error("Bottle resolution returned no assignment.");
        }
        const aliasInput = {
          name: review.name,
          assignmentSource:
            resolution.source === "exact_alias"
              ? undefined
              : ("classifier_approved" as const),
          assignedByActorId: actor.id,
          expectedReview: review,
        };
        return assignBottleAliasInTransaction(tx, {
          bottleId: targetBottleId,
          sourceAliasIdentity: resolution.sourceAliasIdentity,
          ...aliasInput,
        });
      });
      await finalizeBottleAliasAssignment(aliasAssignment);
    } catch (error) {
      if (error instanceof StaleBottleAliasReviewIdentityError) {
        summary.unchanged += 1;
        continue;
      }
      throw error;
    }

    if (isSameTarget) {
      summary.unchanged += 1;
    } else {
      summary.reassigned += 1;
    }
  }

  return summary;
}
