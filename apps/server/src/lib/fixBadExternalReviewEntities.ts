import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import {
  bottles,
  externalReviewArticles,
  externalReviews,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import {
  assignBottleAliasInTransaction,
  finalizeBottleAliasAssignment,
  StaleBottleAliasReviewIdentityError,
} from "@peated/server/lib/bottleAliases";
import { resolveBottleReferenceTarget } from "@peated/server/lib/bottleReferenceResolution";
import { and, eq, ne } from "drizzle-orm";

export type FixBadExternalReviewEntitiesResult = {
  scanned: number;
  reassigned: number;
  unresolved: number;
  errored: number;
  unchanged: number;
};

/**
 * Re-resolve external reviews whose linked Bottle no longer matches the title.
 *
 * This stays intentionally conservative: it never rewrites or deletes the
 * current Bottle record. It only reassigns the external review when an exact alias or
 * reviewed classifier result returns a replacement Bottle.
 */
export async function fixBadExternalReviewEntities(
  {
    user,
  }: {
    user: User;
  },
  classify?: NonNullable<Parameters<typeof resolveBottleReferenceTarget>[1]>,
): Promise<FixBadExternalReviewEntitiesResult> {
  const actor = await getUserActor(user);
  const results = await db
    .select({
      article: externalReviewArticles,
      bottle: bottles,
      review: externalReviews,
    })
    .from(bottles)
    .innerJoin(
      externalReviews,
      and(
        eq(externalReviews.bottleId, bottles.id),
        ne(externalReviews.name, bottles.fullName),
      ),
    )
    .innerJoin(
      externalReviewArticles,
      eq(externalReviews.articleId, externalReviewArticles.id),
    );

  const summary: FixBadExternalReviewEntitiesResult = {
    scanned: 0,
    reassigned: 0,
    unresolved: 0,
    errored: 0,
    unchanged: 0,
  };

  for (const { article, bottle, review } of results) {
    if (review.name.startsWith(bottle.fullName)) {
      continue;
    }

    summary.scanned += 1;

    const resolution = await resolveBottleReferenceTarget(
      {
        reference: {
          id: review.id,
          externalSiteId: article.externalSiteId,
          name: review.name,
          url: article.canonicalUrl,
          imageUrl: null,
          currentBottleId: review.bottleId,
        },
        // Normalized fallback aliases can erase exact identity markers before the
        // classifier sees the real reference title.
        aliasLookupNames: [review.name],
        createdByActorId: actor.id,
      },
      classify,
    );

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
