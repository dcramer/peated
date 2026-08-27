import { db } from "@peated/server/db";
import {
  externalReviewArticles,
  externalReviews,
} from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { dispatchBottleStatsRecompute } from "@peated/server/lib/dispatchBottleStatsRecompute";
import {
  recordIncomingBottleDecisionInTransaction,
  shouldRecordIncomingBottleDecision,
} from "@peated/server/lib/incomingBottleDecisionLog";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { ExternalReviewSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ExternalReviewSerializer } from "@peated/server/serializers/externalReview";
import { eq } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z.object({
  externalReview: z.coerce.number().int().positive(),
  bottle: z.number().int().positive().nullable().optional(),
  hidden: z.boolean().optional(),
});

export default procedure
  .use(requireMod)
  .route({
    method: "PATCH",
    path: "/external-reviews/{externalReview}",
    summary: "Update external review",
    description:
      "Update external review properties such as visibility. Requires moderator privileges",
    operationId: "updateExternalReview",
  })
  .input(InputSchema)
  .output(ExternalReviewSchema)
  .handler(async function ({ input, context, errors }) {
    const {
      externalReview: externalReviewId,
      bottle: nextBottleId,
      hidden,
    } = input;
    const hasBottleUpdate = nextBottleId !== undefined;
    const hasHiddenUpdate = hidden !== undefined;

    if (!hasBottleUpdate && !hasHiddenUpdate) {
      const externalReview = await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, externalReviewId),
      });
      if (!externalReview) {
        throw errors.NOT_FOUND({ message: "External review not found." });
      }
      return await serialize(
        ExternalReviewSerializer,
        externalReview,
        context.user,
      );
    }

    const { updatedExternalReview, previousBottleId } = await db.transaction(
      async (tx) => {
        if (nextBottleId !== undefined && nextBottleId !== null) {
          try {
            await resolveActiveBottleIds(tx, [nextBottleId], {
              lock: "update",
            });
          } catch (error) {
            if (!(error instanceof ActiveBottleSelectionError)) throw error;
            if (error.reason === "missing") {
              throw errors.NOT_FOUND({ message: "Bottle not found." });
            }
            throw errors.CONFLICT({
              message:
                error.reason === "bottle_retired"
                  ? `Bottle ${nextBottleId} is retired.`
                  : `Bottle ${nextBottleId} is not active.`,
            });
          }
        }

        const [locked] = await tx
          .select({
            article: externalReviewArticles,
            externalReview: externalReviews,
          })
          .from(externalReviews)
          .innerJoin(
            externalReviewArticles,
            eq(externalReviews.articleId, externalReviewArticles.id),
          )
          .where(eq(externalReviews.id, externalReviewId))
          .limit(1)
          .for("update", { of: externalReviews });
        if (!locked) {
          throw errors.NOT_FOUND({ message: "External review not found." });
        }
        const { article, externalReview: lockedExternalReview } = locked;

        const update: Partial<typeof externalReviews.$inferInsert> = {};
        if (hasBottleUpdate) update.bottleId = nextBottleId;
        if (hasHiddenUpdate) update.hidden = hidden;
        const [externalReview] = await tx
          .update(externalReviews)
          .set(update)
          .where(eq(externalReviews.id, externalReviewId))
          .returning();
        if (!externalReview) {
          throw errors.INTERNAL_SERVER_ERROR({
            message: "Failed to update external review.",
          });
        }

        if (
          nextBottleId != null &&
          shouldRecordIncomingBottleDecision({
            previousBottleId: lockedExternalReview.bottleId,
            bottleId: nextBottleId,
            decision: "match_existing",
          })
        ) {
          const actor = await getUserActorForDatabase(tx, context.user);
          await recordIncomingBottleDecisionInTransaction(tx, {
            sourceKind: "review",
            sourceId: externalReview.id,
            externalSiteId: article.externalSiteId,
            name: externalReview.name,
            url: article.canonicalUrl,
            decision: "match_existing",
            actor,
            bottleId: nextBottleId,
          });
        }

        return {
          updatedExternalReview: externalReview,
          previousBottleId: lockedExternalReview.bottleId,
        };
      },
    );

    await Promise.all(
      Array.from(
        new Set(
          [previousBottleId, updatedExternalReview.bottleId].filter(
            (id): id is number => id !== null,
          ),
        ),
      ).map((bottleId) =>
        dispatchBottleStatsRecompute(
          "externalReview",
          updatedExternalReview.id,
          bottleId,
        ),
      ),
    );

    return await serialize(
      ExternalReviewSerializer,
      updatedExternalReview,
      context.user,
    );
  });
