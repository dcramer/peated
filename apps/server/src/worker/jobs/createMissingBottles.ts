import { db } from "@peated/server/db";
import { reviewArticles, reviews } from "@peated/server/db/schema";
import {
  getExternalReviewPublicationModeInTransaction,
  publishResolvedReview,
} from "@peated/server/externalReviews/publication";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import {
  assignBottleAliasInTransaction,
  finalizeBottleAliasAssignment,
  StaleBottleAliasReviewIdentityError,
} from "@peated/server/lib/bottleAliases";
import { resolveScrapedBottleReferenceTarget } from "@peated/server/lib/bottleReferenceResolution";
import {
  getIncomingBottleDecisionFromResolutionSource,
  recordIncomingBottleDecisionInTransaction,
  shouldRecordIncomingBottleDecision,
} from "@peated/server/lib/incomingBottleDecisionLog";
import { logInfo, logTelemetryError } from "@peated/server/lib/log";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z
  .object({
    articleId: z.number().int().positive().optional(),
  })
  .strict();

export default async function createMissingBottles(rawInput?: unknown) {
  const { articleId } = InputSchema.parse(rawInput ?? {});
  const systemActor = await getPeatedSystemActor();

  // Advance by id so unresolved reviews are visited once per run instead of
  // hot-looping forever on the same null bottle assignments.
  let cursor = 0;
  let hasMore = true;
  while (hasMore) {
    const missingInReviews = await db
      .select({ article: reviewArticles, review: reviews })
      .from(reviews)
      .innerJoin(reviewArticles, eq(reviews.articleId, reviewArticles.id))
      .where(
        and(
          isNull(reviews.bottleId),
          gt(reviews.id, cursor),
          articleId === undefined
            ? undefined
            : eq(reviewArticles.id, articleId),
        ),
      )
      .orderBy(asc(reviews.id))
      .limit(100);

    hasMore = missingInReviews.length > 0;
    if (!hasMore) break;

    for (const { article, review } of missingInReviews) {
      cursor = review.id;
      const aliasKey = normalizeBottleAliasKey(review.name);

      const resolution = await resolveScrapedBottleReferenceTarget({
        reference: {
          id: review.id,
          externalSiteId: article.externalSiteId,
          name: review.name,
          url: article.canonicalUrl,
          imageUrl: null,
          currentBottleId: review.bottleId,
        },
        // Normalized fallback aliases can collapse exact identity detail before
        // the classifier reviews the full reference title.
        aliasLookupNames: [aliasKey, review.name],
        extractedIdentity:
          review.category === null ? null : { category: review.category },
        createdByActorId: systemActor.id,
      });

      const resolvedAssignment = resolution.assignment;
      const bottleId = resolvedAssignment?.bottleId ?? null;
      if (bottleId) {
        logInfo("Resolved bottle for review {reviewId}", {
          extra: {
            reviewId: review.id,
            bottleId,
            source: resolution.source,
          },
        });
      } else {
        logInfo("Unable to resolve bottle for review {reviewId}", {
          extra: {
            reviewId: review.id,
            source: resolution.source,
          },
        });
        if (resolution.error) {
          logTelemetryError(resolution.error, {
            extra: {
              reviewId: review.id,
            },
          });
        }
        continue;
      }

      const decision = getIncomingBottleDecisionFromResolutionSource(
        resolution.source,
        { createdBottle: resolution.createdBottle },
      );

      let aliasAssignment;
      try {
        aliasAssignment = await db.transaction(async (tx) => {
          const publicationMode =
            await getExternalReviewPublicationModeInTransaction(
              tx,
              article.externalSiteId,
            );
          const assignment = resolution.assignment;
          if (!assignment) {
            throw new Error("Bottle resolution returned no assignment.");
          }
          if (
            resolution.source === "classifier_create_bottle" &&
            assignment.bottleId !== bottleId
          ) {
            throw new Error(
              "Classifier Bottle creation returned an incomplete Bottle assignment.",
            );
          }

          const aliasInput = {
            name: aliasKey,
            backfillNames: [review.name],
            externalSiteId: article.externalSiteId,
            ...(resolution.source === "exact_alias"
              ? {}
              : { assignmentSource: "classifier_approved" as const }),
            assignedByActorId: systemActor.id,
            expectedReview: review,
          };
          const aliasAssignment = await assignBottleAliasInTransaction(tx, {
            bottleId,
            sourceAliasIdentity: resolution.sourceAliasIdentity,
            ...aliasInput,
          });

          if (
            decision !== null &&
            shouldRecordIncomingBottleDecision({
              previousBottleId: review.bottleId,
              bottleId,
              decision,
            })
          ) {
            await recordIncomingBottleDecisionInTransaction(tx, {
              sourceKind: "review",
              sourceId: review.id,
              externalSiteId: article.externalSiteId,
              name: review.name,
              url: article.canonicalUrl,
              decision,
              actor: systemActor,
              bottleId,
              createdBottle: resolution.createdBottle,
              confidence: resolution.confidence,
              model: resolution.model,
              rationale: resolution.rationale,
              metadata: {
                resolutionSource: resolution.source,
                ...(resolution.classifierEvidence
                  ? {
                      classifierEvidence: resolution.classifierEvidence,
                    }
                  : {}),
                issue: article.issue,
              },
            });
          }

          if (publicationMode === "automatic") {
            await publishResolvedReview(tx, article.externalSiteId, review.id);
          }

          return aliasAssignment;
        });
      } catch (error) {
        if (error instanceof StaleBottleAliasReviewIdentityError) {
          logInfo("Skipped stale bottle resolution for review {reviewId}", {
            extra: { reviewId: review.id },
          });
          continue;
        }
        throw error;
      }

      await finalizeBottleAliasAssignment(aliasAssignment, {
        review: {
          id: review.id,
          name: review.name,
          url: article.canonicalUrl,
        },
      });
    }
  }
}
