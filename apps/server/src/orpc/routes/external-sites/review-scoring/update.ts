import { isExternalReviewSiteKey } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  externalReviewPublications,
  externalSiteConfig,
  externalSites,
} from "@peated/server/db/schema";
import { loadReviewScoringSettings } from "@peated/server/externalReviews/scoringSettings";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import { logError } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  ExternalReviewScoringPolicySchema,
  ExternalReviewScoringSettingsSchema,
  ExternalSiteKeySchema,
  REVIEW_SCORING_CONFIG_KEY,
} from "@peated/server/schemas";
import { pushJob } from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "PUT",
    path: "/admin/external-sites/{site}/review-scoring",
    summary: "Update review score settings",
    description:
      "Save a site's score table from a current preview and start updating bottle scores. Requires moderator privileges.",
    operationId: "updateExternalReviewScoring",
  })
  .input(
    z
      .object({
        site: ExternalSiteKeySchema,
        expectedVersion: z.number().int().nonnegative(),
        policy: ExternalReviewScoringPolicySchema,
      })
      .strict(),
  )
  .output(ExternalReviewScoringSettingsSchema)
  .handler(async ({ input, context, errors }) => {
    const result = await db.transaction(async (tx) => {
      const [site] = await tx
        .select()
        .from(externalSites)
        .where(eq(externalSites.type, input.site))
        .for("update");
      if (!site) throw errors.NOT_FOUND({ message: "Site not found." });
      const publication = await tx.query.externalReviewPublications.findFirst({
        where: eq(externalReviewPublications.externalSiteId, site.id),
      });
      if (!publication && !isExternalReviewSiteKey(site.type))
        throw errors.NOT_FOUND({ message: "Review source not found." });
      const previous = (await loadReviewScoringSettings([site.id], tx)).get(
        site.id,
      );
      if ((previous?.version ?? 0) !== input.expectedVersion)
        throw errors.CONFLICT({
          message: "Scoring settings changed. Preview your changes again.",
        });
      const settings = {
        version: input.expectedVersion + 1,
        policy: input.policy,
        recomputePending: true,
      };
      await tx
        .insert(externalSiteConfig)
        .values({
          externalSiteId: site.id,
          key: REVIEW_SCORING_CONFIG_KEY,
          value: settings,
        })
        .onConflictDoUpdate({
          target: [externalSiteConfig.externalSiteId, externalSiteConfig.key],
          set: { value: settings, updatedAt: new Date() },
        });
      return { site, previous, settings };
    });
    auditLog({
      event: AuditEvent.EXTERNAL_REVIEW_SCORING_UPDATED,
      userId: context.user.id,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: {
        siteId: result.site.id,
        previous: result.previous,
        settings: result.settings,
      },
    });
    try {
      await pushJob(
        "UpdateSiteReviewScores",
        { siteId: result.site.id },
        { removeOnComplete: true, removeOnFail: false },
      );
    } catch (error) {
      // Ratings keeps the saved pending flag visible so moderators can retry a failed dispatch.
      logError(error, {
        extra: { siteId: result.site.id, version: result.settings.version },
      });
    }
    return result.settings;
  });
