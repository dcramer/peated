import {
  repairWhiskyAdvocateScores,
  WhiskyAdvocateSiteNotFoundError,
} from "@peated/server/externalReviews/repairWhiskyAdvocateScores";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import { dispatchBottleStatsRecomputes } from "@peated/server/lib/dispatchBottleStatsRecompute";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { z } from "zod";

const ResultSchema = z
  .object({
    totalReviews: z.number().int().nonnegative(),
    updatedReviews: z.number().int().nonnegative(),
    unchangedReviews: z.number().int().nonnegative(),
    preservedNativeScores: z.number().int().nonnegative(),
    skippedLegacyScores: z.number().int().nonnegative(),
    affectedBottles: z.number().int().nonnegative(),
    queuedBottleUpdates: z.number().int().nonnegative(),
  })
  .strict();

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/admin/external-sites/whiskyadvocate/repair-review-scores",
    summary: "Repair Whisky Advocate review scores",
    description:
      "Restore native scores retained by the legacy Whisky Advocate import and queue affected Bottle summary updates. Requires administrator privileges.",
    operationId: "repairWhiskyAdvocateReviewScores",
  })
  .input(z.object({}).strict().default({}))
  .output(ResultSchema)
  .handler(async ({ context, errors }) => {
    let repair;
    try {
      repair = await repairWhiskyAdvocateScores();
    } catch (error) {
      if (error instanceof WhiskyAdvocateSiteNotFoundError) {
        throw errors.NOT_FOUND({ message: error.message, cause: error });
      }
      throw error;
    }

    await dispatchBottleStatsRecomputes(
      "externalReview",
      repair.siteId,
      repair.affectedBottleIds,
    );

    const result = {
      totalReviews: repair.totalReviews,
      updatedReviews: repair.updatedReviews,
      unchangedReviews: repair.unchangedReviews,
      preservedNativeScores: repair.preservedNativeScores,
      skippedLegacyScores: repair.skippedLegacyScores,
      affectedBottles: repair.affectedBottleIds.length,
      queuedBottleUpdates: repair.affectedBottleIds.length,
    };
    auditLog({
      event: AuditEvent.EXTERNAL_REVIEW_SCORES_REPAIRED,
      userId: context.user.id,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: {
        site: "whiskyadvocate",
        ...result,
      },
    });

    return result;
  });
