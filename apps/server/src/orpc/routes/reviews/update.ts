import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottles,
  reviews,
  type Review,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import {
  CatalogTargetResolutionError,
  isStagedTargetlessCatalogMappingError,
  lockCatalogTargetAssignmentDescriptorInTransaction,
  resolveCatalogTargetForAssignment,
} from "@peated/server/lib/catalogTargets";
import {
  recordIncomingBottleDecisionInTransaction,
  shouldRecordIncomingBottleDecision,
} from "@peated/server/lib/incomingBottleDecisionLog";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { ReviewSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ReviewSerializer } from "@peated/server/serializers/review";
import { eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z.object({
  review: z.number(),
  bottle: z.number().nullable().optional(),
  release: z.number().nullable().optional(),
  hidden: z.boolean().optional(),
});

const MAX_IDENTITY_RETRIES = 3;

class ReviewIdentityChangedError extends Error {}

/**
 * Catalog resolution and locking must precede the Review lock. If the retained
 * identity changed since the snapshot, roll back those locks and retry from a
 * fresh snapshot instead of reversing the catalog-to-consumer lock order.
 */
function hasSameIdentity(left: Review, right: Review): boolean {
  return (
    left.targetId === right.targetId &&
    left.bottleId === right.bottleId &&
    left.releaseId === right.releaseId
  );
}

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/reviews/{review}",
    summary: "Update review",
    description:
      "Update review properties such as visibility. Requires moderator privileges",
    operationId: "updateReview",
  })
  .input(
    InputSchema.partial().extend({
      review: z.coerce.number(),
    }),
  )
  .output(ReviewSchema)
  .handler(async function ({ input, context, errors }) {
    const {
      review: reviewId,
      bottle: nextBottleInput,
      release: nextReleaseInput,
      ...data
    } = input;

    let [reviewSnapshot] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!reviewSnapshot) {
      throw errors.NOT_FOUND({
        message: "Review not found.",
      });
    }

    if (
      Object.values(data).length === 0 &&
      nextBottleInput === undefined &&
      nextReleaseInput === undefined
    ) {
      return await serialize(ReviewSerializer, reviewSnapshot, context.user);
    }

    const originalBottleId = reviewSnapshot.bottleId;

    try {
      for (let attempt = 0; attempt < MAX_IDENTITY_RETRIES; attempt += 1) {
        try {
          const newReview = await db.transaction(async (tx) => {
            let resolvedBottleId =
              nextBottleInput !== undefined
                ? nextBottleInput
                : reviewSnapshot.bottleId;
            let resolvedReleaseId =
              nextReleaseInput !== undefined
                ? nextReleaseInput
                : reviewSnapshot.releaseId;

            if (nextBottleInput === null) {
              resolvedBottleId = null;
              resolvedReleaseId = null;
            } else if (
              nextBottleInput !== undefined &&
              nextReleaseInput === undefined &&
              (nextBottleInput !== originalBottleId ||
                nextBottleInput !== reviewSnapshot.bottleId)
            ) {
              resolvedReleaseId = null;
            }

            const explicitPairMatchesSnapshot =
              nextReleaseInput != null &&
              nextReleaseInput === reviewSnapshot.releaseId &&
              (nextBottleInput === undefined ||
                nextBottleInput === reviewSnapshot.bottleId);
            if (
              nextBottleInput !== null &&
              nextReleaseInput != null &&
              !explicitPairMatchesSnapshot
            ) {
              const targetRelease = await tx.query.bottleReleases.findFirst({
                where: eq(bottleReleases.id, nextReleaseInput),
              });

              if (!targetRelease) {
                throw errors.NOT_FOUND({
                  message: "Release not found.",
                });
              }

              if (
                nextBottleInput !== undefined &&
                nextBottleInput !== targetRelease.bottleId
              ) {
                throw errors.BAD_REQUEST({
                  message: "Release does not belong to the selected bottle.",
                });
              }

              resolvedBottleId = targetRelease.bottleId;
              resolvedReleaseId = targetRelease.id;
            }

            const identityChanged =
              resolvedBottleId !== reviewSnapshot.bottleId ||
              resolvedReleaseId !== reviewSnapshot.releaseId;
            const explicitIdentityClear = nextBottleInput === null;
            if (
              identityChanged &&
              nextBottleInput !== undefined &&
              nextBottleInput !== null
            ) {
              const explicitBottle = await tx.query.bottles.findFirst({
                where: eq(bottles.id, nextBottleInput),
                columns: { id: true },
              });
              if (!explicitBottle) {
                throw errors.NOT_FOUND({
                  message: "Bottle not found.",
                });
              }
            }

            let target = null;
            if (!explicitIdentityClear) {
              try {
                if (!identityChanged && reviewSnapshot.targetId !== null) {
                  target = await resolveCatalogTargetForAssignment(
                    {
                      kind: "target",
                      targetId: reviewSnapshot.targetId,
                    },
                    tx,
                  );
                } else if (resolvedBottleId !== null) {
                  target = await resolveCatalogTargetForAssignment(
                    {
                      kind: "legacy",
                      bottleId: resolvedBottleId,
                      releaseId: resolvedReleaseId,
                      context: {
                        caller: "reviews.update",
                        operation: identityChanged
                          ? "correctIdentity"
                          : "backfill",
                      },
                    },
                    tx,
                  );
                } else if (reviewSnapshot.targetId !== null) {
                  target = await resolveCatalogTargetForAssignment(
                    {
                      kind: "target",
                      targetId: reviewSnapshot.targetId,
                    },
                    tx,
                  );
                }
              } catch (error) {
                if (
                  identityChanged ||
                  reviewSnapshot.targetId !== null ||
                  !isStagedTargetlessCatalogMappingError(error)
                ) {
                  throw error;
                }
                // Staged rows remain targetless until their legacy parent has
                // a group or BottleRelease has a concrete promotion.
              }
            }

            if (target) {
              await lockCatalogTargetAssignmentDescriptorInTransaction(
                tx,
                target,
              );
            }

            const [lockedReview] = await tx
              .select()
              .from(reviews)
              .where(eq(reviews.id, reviewId))
              .limit(1)
              .for("update");
            if (!lockedReview) {
              throw errors.NOT_FOUND({
                message: "Review not found.",
              });
            }
            if (!hasSameIdentity(lockedReview, reviewSnapshot)) {
              throw new ReviewIdentityChangedError();
            }

            const targetId = explicitIdentityClear
              ? null
              : (target?.targetId ?? null);
            const [updatedReview] = await tx
              .update(reviews)
              .set({
                ...data,
                targetId,
                bottleId: resolvedBottleId,
                releaseId: resolvedReleaseId,
              })
              .where(eq(reviews.id, reviewId))
              .returning();

            if (!updatedReview) {
              throw errors.INTERNAL_SERVER_ERROR({
                message: "Failed to update review.",
              });
            }

            if (
              shouldRecordIncomingBottleDecision({
                previousBottleId: lockedReview.bottleId,
                bottleId: updatedReview.bottleId,
                decision: "match_existing",
              })
            ) {
              const actor = await getUserActorForDatabase(tx, context.user);
              await recordIncomingBottleDecisionInTransaction(tx, {
                sourceKind: "review",
                sourceId: updatedReview.id,
                externalSiteId: updatedReview.externalSiteId,
                name: updatedReview.name,
                url: updatedReview.url,
                decision: "match_existing",
                actor,
                bottleId: updatedReview.bottleId!,
                releaseId: updatedReview.releaseId,
              });
            }

            return updatedReview;
          });

          return await serialize(ReviewSerializer, newReview, context.user);
        } catch (error) {
          if (!(error instanceof ReviewIdentityChangedError)) throw error;

          const [currentReview] = await db
            .select()
            .from(reviews)
            .where(eq(reviews.id, reviewId))
            .limit(1);
          if (!currentReview) {
            throw errors.NOT_FOUND({
              message: "Review not found.",
            });
          }
          reviewSnapshot = currentReview;
        }
      }
    } catch (error) {
      if (error instanceof CatalogTargetResolutionError) {
        throw errors.CONFLICT({ message: error.message, cause: error });
      }
      throw error;
    }

    throw errors.CONFLICT({
      message: "Review identity changed while it was being updated. Retry.",
    });
  });
