import { isExternalReviewSiteKey } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  externalReviewArticles,
  externalReviewPublications,
  externalReviews,
  externalSites,
} from "@peated/server/db/schema";
import { publishResolvedReviews } from "@peated/server/externalReviews/publication";
import { AuditEvent, auditLog } from "@peated/server/lib/auditLog";
import { dispatchBottleStatsRecompute } from "@peated/server/lib/dispatchBottleStatsRecompute";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import {
  ExternalReviewPublicationInputSchema,
  ExternalReviewPublicationSchema,
  ExternalSiteKeySchema,
} from "@peated/server/schemas";
import { serializeExternalReviewPublication } from "@peated/server/serializers/externalSite";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

const InputSchema = z
  .object({
    site: ExternalSiteKeySchema,
    publication: ExternalReviewPublicationInputSchema,
  })
  .strict();

const RECOMPUTE_BATCH_SIZE = 50;

export default procedure
  .use(requireMod)
  .route({
    method: "PUT",
    path: "/admin/external-sites/{site}/review-publication",
    summary: "Update external review publication",
    description:
      "Approve or withdraw public display of a site's reviews. Changes also queue updates to affected bottle score summaries. Requires moderator privileges.",
    operationId: "updateExternalReviewPublication",
  })
  .input(InputSchema)
  .output(ExternalReviewPublicationSchema)
  .handler(async ({ input, context, errors }) => {
    const { previous, publication, site } = await db.transaction(async (tx) => {
      const [site] = await tx
        .select()
        .from(externalSites)
        .where(eq(externalSites.type, input.site))
        .limit(1)
        .for("update");
      if (!site) throw errors.NOT_FOUND({ message: "Site not found." });

      const [existing] = await tx
        .select()
        .from(externalReviewPublications)
        .where(eq(externalReviewPublications.externalSiteId, site.id))
        .limit(1)
        .for("update");
      if (!existing && !isExternalReviewSiteKey(input.site)) {
        throw errors.NOT_FOUND({ message: "Review source not found." });
      }

      const previous = serializeExternalReviewPublication(
        site.id,
        existing ?? null,
      );
      const approvedAt = input.publication.approved
        ? (existing?.approvedAt ?? new Date())
        : null;
      const [publication] = await tx
        .insert(externalReviewPublications)
        .values({ externalSiteId: site.id, approvedAt })
        .onConflictDoUpdate({
          target: externalReviewPublications.externalSiteId,
          set: { approvedAt, updatedAt: sql`NOW()` },
        })
        .returning();
      if (!publication) {
        throw errors.INTERNAL_SERVER_ERROR({
          message: "Failed to update review publishing.",
        });
      }

      if (!previous.approved && input.publication.approved) {
        await publishResolvedReviews(tx, site.id);
      }

      return { previous, publication, site };
    });

    const result = serializeExternalReviewPublication(site.id, publication);
    auditLog({
      event: AuditEvent.EXTERNAL_REVIEW_PUBLICATION_UPDATED,
      userId: context.user.id,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: {
        site: site.type,
        previous: previous.approved,
        approved: result.approved,
      },
    });

    if (previous.approved !== result.approved) {
      const affected = await db
        .selectDistinct({
          reviewId: externalReviews.id,
          bottleId: externalReviews.bottleId,
        })
        .from(externalReviews)
        .innerJoin(
          externalReviewArticles,
          eq(externalReviewArticles.id, externalReviews.articleId),
        )
        .where(
          and(
            eq(externalReviewArticles.externalSiteId, site.id),
            isNotNull(externalReviews.bottleId),
          ),
        );

      for (
        let offset = 0;
        offset < affected.length;
        offset += RECOMPUTE_BATCH_SIZE
      ) {
        await Promise.all(
          affected
            .slice(offset, offset + RECOMPUTE_BATCH_SIZE)
            .map(({ reviewId, bottleId }) =>
              dispatchBottleStatsRecompute(
                "externalReview",
                reviewId,
                bottleId!,
              ),
            ),
        );
      }
    }

    return result;
  });
