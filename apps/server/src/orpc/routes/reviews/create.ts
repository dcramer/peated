import { normalizeBottle } from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  externalSites,
  reviews,
} from "@peated/server/db/schema";
import {
  assignBottleAliasInTransaction,
  finalizeBottleAliasAssignment,
} from "@peated/server/lib/bottleAliases";
import { resolveBottleReferenceTarget } from "@peated/server/lib/bottleReferenceResolution";
import { mapRows } from "@peated/server/lib/db";
import { logError } from "@peated/server/lib/log";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { ReviewInputSchema, ReviewSchema } from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { ReviewSerializer } from "@peated/server/serializers/review";
import { and, eq, or, sql } from "drizzle-orm";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/reviews",
    summary: "Create review",
    description:
      "Create a new review from external site data with automatic bottle matching and alias creation. Requires admin privileges",
    operationId: "createReview",
  })
  .input(ReviewInputSchema)
  .output(ReviewSchema)
  .handler(async function ({ input, context, errors }) {
    const site = await db.query.externalSites.findFirst({
      where: eq(externalSites.type, input.site),
    });

    if (!site) {
      throw errors.NOT_FOUND({
        message: "Site not found.",
      });
    }

    const rawName = input.name;
    const { name: normalizedName } = normalizeBottle({ name: rawName });
    const resolution = await resolveBottleReferenceTarget({
      reference: {
        externalSiteId: site.id,
        name: rawName,
        url: input.url,
        imageUrl: null,
        currentBottleId: null,
        currentReleaseId: null,
      },
      // Normalized review titles can strip release markers like year or batch
      // detail, so only the raw exact alias is safe to trust before the
      // classifier has a chance to review the full reference.
      aliasLookupNames: [rawName],
      extractedIdentity: {
        category: input.category,
      },
      user: context.user!,
    });
    if (resolution.error) {
      logError(resolution.error, {
        review: {
          site: input.site,
          name: rawName,
          url: input.url,
        },
      });
    }
    const bottleId = resolution.bottleId;
    const releaseId = resolution.releaseId;
    const reviewName =
      resolution.releaseId != null && rawName !== normalizedName
        ? rawName
        : normalizedName;
    const reviewNameCandidates = Array.from(
      new Set([reviewName.toLowerCase(), normalizedName.toLowerCase()]),
    );

    const { review, aliasAssignment } = await db.transaction(async (tx) => {
      const existingReview =
        (await tx.query.reviews.findFirst({
          where: and(
            eq(reviews.externalSiteId, site.id),
            eq(reviews.url, input.url),
          ),
        })) ??
        (await tx.query.reviews.findFirst({
          where: and(
            eq(reviews.externalSiteId, site.id),
            eq(reviews.issue, input.issue),
            or(
              ...reviewNameCandidates.map((name) =>
                eq(sql`LOWER(${reviews.name})`, name),
              ),
            ),
          ),
        }));

      let review;
      if (existingReview) {
        [review] = await tx
          .update(reviews)
          .set({
            bottleId: bottleId ?? existingReview.bottleId,
            releaseId: releaseId ?? existingReview.releaseId,
            name: reviewName,
            rating: input.rating,
            url: input.url,
            updatedAt: sql`NOW()`,
          })
          .where(eq(reviews.id, existingReview.id))
          .returning();
      } else {
        const { rows } = await tx.execute(
          sql`INSERT INTO ${reviews} (bottle_id, release_id, external_site_id, name, issue, rating, url)
              VALUES (${bottleId}, ${releaseId}, ${site.id}, ${reviewName}, ${input.issue}, ${input.rating}, ${input.url})
              ON CONFLICT (external_site_id, LOWER(name), issue)
              DO UPDATE
              SET bottle_id = COALESCE(excluded.bottle_id, ${reviews.bottleId}),
                  release_id = COALESCE(excluded.release_id, ${reviews.releaseId}),
                  rating = excluded.rating,
                  url = excluded.url,
                  updated_at = NOW()
              RETURNING *`,
        );

        [review] = mapRows(rows, reviews);
      }

      if (!bottleId) {
        await tx
          .insert(bottleAliases)
          .values({
            name: reviewName,
          })
          .onConflictDoNothing();
        return { review, aliasAssignment: null };
      }

      const aliasAssignment = await assignBottleAliasInTransaction(tx, {
        bottleId,
        releaseId,
        name: reviewName,
      });

      return { review, aliasAssignment };
    });

    if (aliasAssignment) {
      await finalizeBottleAliasAssignment(aliasAssignment, {
        review: {
          site: input.site,
          name: reviewName,
          url: input.url,
        },
      });
    }

    await db
      .update(externalSites)
      .set({ lastRunAt: sql`NOW()` })
      .where(eq(externalSites.id, site.id));

    return await serialize(ReviewSerializer, review, context.user);
  });
