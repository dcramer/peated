import { db } from "@peated/server/db";
import { reviews } from "@peated/server/db/schema";
import {
  assignBottleAliasInTransaction,
  finalizeBottleAliasAssignment,
} from "@peated/server/lib/bottleAliases";
import { resolveBottleReferenceTarget } from "@peated/server/lib/bottleReferenceResolution";
import {
  getIncomingBottleDecisionFromResolutionSource,
  recordIncomingBottleDecisionInTransaction,
  shouldRecordIncomingBottleDecision,
} from "@peated/server/lib/incomingBottleDecisionLog";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import { getAutomationModeratorUser } from "@peated/server/lib/systemUser";
import { and, asc, gt, isNull } from "drizzle-orm";

export default async function createMissingBottles() {
  const systemUser = await getAutomationModeratorUser();

  // Advance by id so unresolved reviews are visited once per run instead of
  // hot-looping forever on the same null bottle assignments.
  let cursor = 0;
  let hasMore = true;
  while (hasMore) {
    const missingInReviews = await db
      .select()
      .from(reviews)
      .where(and(isNull(reviews.bottleId), gt(reviews.id, cursor)))
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
      });

      if (resolution.bottleId) {
        console.log(
          `Resolved bottle for review [${review.id}] via ${resolution.source}`,
        );
      } else {
        console.log(`Unable to resolve bottle for review [${review.id}]`);
        if (resolution.error) {
          console.error(resolution.error);
        }
        continue;
      }

      const bottleId = resolution.bottleId;
      const decision = getIncomingBottleDecisionFromResolutionSource(
        resolution.source,
      );

      const aliasAssignment = await db.transaction(async (tx) => {
        const aliasAssignment = await assignBottleAliasInTransaction(tx, {
          bottleId,
          releaseId: resolution.releaseId,
          name: aliasKey,
          backfillNames: [review.name],
          externalSiteId: review.externalSiteId,
          ...(resolution.source !== "exact_alias"
            ? {
                assignmentSource: "classifier_approved" as const,
                assignedById: systemUser.id,
              }
            : {}),
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
            actorType: "system",
            actorUserId: systemUser.id,
            bottleId,
            releaseId: resolution.releaseId,
            createdBottle: resolution.createdBottle,
            createdRelease: resolution.createdRelease,
            confidence: resolution.confidence,
            model: resolution.model,
            rationale: resolution.rationale,
            metadata: {
              resolutionSource: resolution.source,
              issue: review.issue,
            },
          });
        }

        return aliasAssignment;
      });

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
