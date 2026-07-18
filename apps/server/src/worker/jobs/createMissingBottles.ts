import { db } from "@peated/server/db";
import { reviews } from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import {
  assignBottleAliasInTransaction,
  finalizeBottleAliasAssignment,
  StaleBottleAliasReviewIdentityError,
} from "@peated/server/lib/bottleAliases";
import { resolveBottleReferenceTarget } from "@peated/server/lib/bottleReferenceResolution";
import {
  getIncomingBottleDecisionFromResolutionSource,
  recordIncomingBottleDecisionInTransaction,
  shouldRecordIncomingBottleDecision,
} from "@peated/server/lib/incomingBottleDecisionLog";
import { logInfo, logTelemetryError } from "@peated/server/lib/log";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import { getAutomationModeratorUser } from "@peated/server/lib/systemUser";
import { and, asc, gt, isNull } from "drizzle-orm";

export default async function createMissingBottles() {
  const systemUser = await getAutomationModeratorUser();
  const systemActor = await getPeatedSystemActor();

  // Advance by id so unresolved reviews are visited once per run instead of
  // hot-looping forever on the same null bottle assignments.
  let cursor = 0;
  let hasMore = true;
  while (hasMore) {
    const missingInReviews = await db
      .select()
      .from(reviews)
      .where(
        and(
          isNull(reviews.bottleId),
          isNull(reviews.targetId),
          gt(reviews.id, cursor),
        ),
      )
      .orderBy(asc(reviews.id))
      .limit(100);

    hasMore = missingInReviews.length > 0;
    if (!hasMore) break;

    for (const review of missingInReviews) {
      cursor = review.id;
      const aliasKey = normalizeBottleAliasKey(review.name);

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
        // Normalized fallback aliases can collapse real release detail to the
        // parent before the classifier reviews the full reference title.
        aliasLookupNames: [aliasKey, review.name],
        user: systemUser,
        createdByActorId: systemActor.id,
      });

      const resolvedIdentity = resolution.assignment?.consumerIdentity ?? null;
      if (resolvedIdentity?.bottleId) {
        logInfo("Resolved bottle for review {reviewId}", {
          extra: {
            reviewId: review.id,
            bottleId: resolvedIdentity.bottleId,
            releaseId: resolvedIdentity.releaseId,
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

      const bottleId = resolvedIdentity!.bottleId!;
      const decision = getIncomingBottleDecisionFromResolutionSource(
        resolution.source,
        { createdBottle: resolution.createdBottle },
      );

      let aliasAssignment;
      try {
        aliasAssignment = await db.transaction(async (tx) => {
          const assignment = resolution.assignment;
          if (!assignment) {
            throw new Error("Bottle resolution returned no assignment.");
          }
          if (
            resolution.source === "classifier_create_bottle" &&
            (assignment.kind !== "target" ||
              assignment.target.bottleId !== bottleId)
          ) {
            throw new Error(
              "Classifier Bottle creation returned an incomplete exact target.",
            );
          }

          const aliasInput = {
            name: aliasKey,
            backfillNames: [review.name],
            externalSiteId: review.externalSiteId,
            ...(resolution.source === "exact_alias"
              ? {}
              : { assignmentSource: "classifier_approved" as const }),
            assignedByActorId: systemActor.id,
            expectedReview: review,
          };
          const aliasAssignment =
            assignment.kind === "target"
              ? await assignBottleAliasInTransaction(tx, {
                  ...assignment,
                  ...aliasInput,
                })
              : await assignBottleAliasInTransaction(tx, {
                  ...assignment,
                  context: {
                    caller: "createMissingBottles",
                    operation:
                      resolution.source === "exact_alias"
                        ? "reuseExactReviewAlias"
                        : "assignResolvedReviewAlias",
                  },
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
              externalSiteId: review.externalSiteId,
              name: review.name,
              url: review.url,
              decision,
              actor: systemActor,
              bottleId,
              releaseId: assignment.consumerIdentity.releaseId,
              targetId:
                assignment.kind === "target"
                  ? assignment.target.targetId
                  : null,
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
                issue: review.issue,
              },
            });
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
          url: review.url,
        },
      });
    }
  }
}
