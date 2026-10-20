import { db } from "@peated/server/db";
import {
  externalReviewArticles,
  externalReviews,
} from "@peated/server/db/schema";
import {
  isExternalReviewPublicationApprovedInTransaction,
  publishResolvedReview,
} from "@peated/server/externalReviews/publication";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import {
  assignReviewBottleResolutionInTransaction,
  persistReviewBottleCheck,
  resolveScrapedBottleReferenceTarget,
} from "@peated/server/lib/bottleReferenceResolution";
import type { assignBottleReferenceInTransaction } from "@peated/server/lib/bottleReferences";
import {
  finalizeBottleReferenceAssignment,
  StaleBottleReferenceReviewIdentityError,
} from "@peated/server/lib/bottleReferences";
import { dispatchBottleStatsRecompute } from "@peated/server/lib/dispatchBottleStatsRecompute";
import {
  ExternalReviewResolutionVersionSchema,
  reviewResolutionAttemptCondition,
} from "@peated/server/lib/externalReviewResolution";
import {
  getIncomingBottleDecisionFromResolutionSource,
  recordIncomingBottleDecisionInTransaction,
  shouldRecordIncomingBottleDecision,
  type IncomingBottleDecisionMetadata,
} from "@peated/server/lib/incomingBottleDecisionLog";
import { logInfo } from "@peated/server/lib/log";
import { normalizeBottleReferenceKey } from "@peated/server/lib/normalize";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { pushUniqueJob } from "../dispatch";
import type { JobPayload } from "../types";

const InputSchema = z
  .object({
    articleId: z.number().int().positive().optional(),
    reviewId: z.number().int().positive().optional(),
    expectedResolution: ExternalReviewResolutionVersionSchema.optional(),
  })
  .strict()
  .refine(
    ({ reviewId, expectedResolution }) =>
      !expectedResolution || reviewId !== undefined,
    {
      message: "A recheck version requires a review ID.",
    },
  );

export type CreateMissingBottlesServices = {
  classifyReference: NonNullable<
    Parameters<typeof resolveScrapedBottleReferenceTarget>[1]
  >;
};

export async function createMissingBottles(
  rawInput?: JobPayload,
  services?: CreateMissingBottlesServices,
) {
  const { articleId, reviewId, expectedResolution } = InputSchema.parse(
    rawInput ?? {},
  );
  const systemActor = await getPeatedSystemActor();

  // Review matching owns batch isolation: advance by ID even though dispatch
  // leaves reviews pending until their individual jobs finish.
  let cursor = 0;
  let hasMore = true;
  while (hasMore) {
    const missingInReviews = await db
      .select({ article: externalReviewArticles, review: externalReviews })
      .from(externalReviews)
      .innerJoin(
        externalReviewArticles,
        eq(externalReviews.articleId, externalReviewArticles.id),
      )
      .where(
        and(
          isNull(externalReviews.bottleId),
          expectedResolution
            ? and(
                eq(externalReviews.name, expectedResolution.name),
                reviewResolutionAttemptCondition(
                  new Date(expectedResolution.attemptedAt),
                ),
              )
            : isNull(externalReviews.bottleNoMatchAt),
          isNull(externalReviews.removedAt),
          reviewId === undefined ? undefined : eq(externalReviews.id, reviewId),
          gt(externalReviews.id, cursor),
          articleId === undefined
            ? undefined
            : eq(externalReviewArticles.id, articleId),
        ),
      )
      .orderBy(asc(externalReviews.id))
      .limit(100);

    hasMore = missingInReviews.length > 0;
    if (!hasMore) break;

    for (const { article, review } of missingInReviews) {
      cursor = review.id;
      if (reviewId === undefined) {
        await pushUniqueJob("CreateMissingBottles", { reviewId: review.id });
        continue;
      }
      const referenceKey = normalizeBottleReferenceKey(review.name);

      const resolution = await resolveScrapedBottleReferenceTarget(
        {
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
          referenceLookupNames: [referenceKey, review.name],
          createdByActorId: systemActor.id,
        },
        services?.classifyReference,
      );

      if (resolution.classification) {
        await persistReviewBottleCheck({
          reviewId: review.id,
          classification: resolution.classification,
        });
      }

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
        if (resolution.error) throw resolution.error;
        // Review matching owns the result version. A stale run must not advance a newer attempt.
        await db
          .update(externalReviews)
          .set({ bottleNoMatchAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(externalReviews.id, review.id),
              isNull(externalReviews.bottleId),
              isNull(externalReviews.removedAt),
              eq(externalReviews.name, review.name),
              eq(externalReviews.articleId, review.articleId),
              reviewResolutionAttemptCondition(review.bottleNoMatchAt),
            ),
          );
        continue;
      }

      const decision = getIncomingBottleDecisionFromResolutionSource(
        resolution.source,
        { createdBottle: resolution.createdBottle },
      );

      let referenceAssignment;
      try {
        referenceAssignment = await db.transaction(async (tx) => {
          const publicationApproved =
            await isExternalReviewPublicationApprovedInTransaction(
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

          const referenceInput: Omit<
            Parameters<typeof assignBottleReferenceInTransaction>[1],
            "bottleId" | "sourceReferenceIdentity"
          > = {
            name: referenceKey,
            backfillNames: [review.name],
            externalSiteId: article.externalSiteId,
            assignedByActorId: systemActor.id,
            expectedReview: review,
          };
          if (resolution.source !== "exact_reference") {
            referenceInput.assignmentSource = "classifier_approved";
          }
          const referenceAssignment =
            await assignReviewBottleResolutionInTransaction(tx, resolution, {
              bottleId,
              sourceReferenceIdentity: resolution.sourceReferenceIdentity,
              ...referenceInput,
              expectedReview: review,
            });

          if (
            decision !== null &&
            shouldRecordIncomingBottleDecision({
              previousBottleId: review.bottleId,
              bottleId,
              decision,
            })
          ) {
            const metadata: IncomingBottleDecisionMetadata = {
              resolutionSource: resolution.source,
              issue: article.issue,
            };
            if (resolution.classifierEvidence) {
              metadata.classifierEvidence = resolution.classifierEvidence;
            }
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
              metadata,
            });
          }

          if (publicationApproved) {
            await publishResolvedReview(tx, article.externalSiteId, review.id);
          }

          return referenceAssignment;
        });
      } catch (error) {
        if (error instanceof StaleBottleReferenceReviewIdentityError) {
          logInfo("Skipped stale bottle resolution for review {reviewId}", {
            extra: { reviewId: review.id },
          });
          continue;
        }
        throw error;
      }

      if (!referenceAssignment) {
        await dispatchBottleStatsRecompute(
          "externalReview",
          review.id,
          bottleId,
        );
        continue;
      }
      await finalizeBottleReferenceAssignment(referenceAssignment, {
        review: {
          id: review.id,
          name: review.name,
          url: article.canonicalUrl,
        },
      });
    }
  }
}

export default async function createMissingBottlesJob(rawInput?: JobPayload) {
  return await createMissingBottles(rawInput);
}
