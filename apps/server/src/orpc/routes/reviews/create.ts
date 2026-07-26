import {
  normalizeBottle,
  normalizeBottleAliasKey,
} from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import { externalSites, reviews, storePrices } from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import {
  assignBottleAliasInTransaction,
  finalizeBottleAliasAssignment,
} from "@peated/server/lib/bottleAliases";
import {
  lockBottleReferenceResolutionAssignmentInTransaction,
  resolveBottleReferenceTarget,
} from "@peated/server/lib/bottleReferenceResolution";
import { mapRows } from "@peated/server/lib/db";
import {
  getIncomingBottleDecisionFromResolutionSource,
  recordIncomingBottleDecisionInTransaction,
  shouldRecordIncomingBottleDecision,
} from "@peated/server/lib/incomingBottleDecisionLog";
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
    const systemActor = await getPeatedSystemActor();

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
    const aliasKey = normalizeBottleAliasKey(rawName);
    // New assignments use the deterministic key, while exact lookup also
    // accepts legacy raw aliases created before alias keys existed.
    const resolution = await resolveBottleReferenceTarget({
      reference: {
        externalSiteId: site.id,
        name: rawName,
        url: input.url,
        imageUrl: null,
        currentBottleId: null,
        currentReleaseId: null,
      },
      aliasLookupNames: [aliasKey, rawName],
      extractedIdentity: {
        category: input.category,
      },
      user: context.user!,
      createdByActorId: systemActor.id,
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
    const resolvedAssignment = resolution.assignment;
    const bottleId = resolvedAssignment?.bottleId ?? null;
    const classifierCreated = resolution.source === "classifier_create_bottle";
    const reviewName = normalizedName;
    const reviewNameCandidates = [reviewName.toLowerCase()];

    const { review, aliasAssignment } = await db.transaction(async (tx) => {
      const lockedAssignment =
        await lockBottleReferenceResolutionAssignmentInTransaction(
          tx,
          resolution,
          { caller: "reviews.create", operation: "persistResolution" },
        );

      if (classifierCreated) {
        if (bottleId === null || lockedAssignment?.bottleId !== bottleId) {
          throw new Error(
            "Classifier concrete Bottle creation returned an incomplete Bottle assignment.",
          );
        }
      }
      if (lockedAssignment) {
        const aliasLookupNames = Array.from(
          new Set(
            [aliasKey, reviewName, rawName].map((name) => name.toLowerCase()),
          ),
        );
        await tx
          .select({ id: storePrices.id })
          .from(storePrices)
          .where(
            and(
              eq(storePrices.externalSiteId, site.id),
              or(
                ...aliasLookupNames.map((name) =>
                  eq(sql`LOWER(${storePrices.name})`, name),
                ),
              ),
            ),
          )
          .for("update");
      }
      // Preserve or replace identity only from the Review version locked after
      // the Bottle and matching StorePrices. Alias synchronization uses that
      // same consumer order, avoiding StorePrice/Review lock inversion.
      let [existingReview] = await tx
        .select()
        .from(reviews)
        .where(
          and(eq(reviews.externalSiteId, site.id), eq(reviews.url, input.url)),
        )
        .limit(1)
        .for("update");
      if (!existingReview) {
        [existingReview] = await tx
          .select()
          .from(reviews)
          .where(
            and(
              eq(reviews.externalSiteId, site.id),
              eq(reviews.issue, input.issue),
              or(
                ...reviewNameCandidates.map((name) =>
                  eq(sql`LOWER(${reviews.name})`, name),
                ),
              ),
            ),
          )
          .limit(1)
          .for("update");
      }

      let review;
      if (existingReview) {
        const incomingIdentityIsAuthoritative =
          bottleId !== null &&
          (existingReview.bottleId === null ||
            existingReview.bottleId === bottleId);
        const identity = incomingIdentityIsAuthoritative
          ? { bottleId }
          : { bottleId: existingReview.bottleId };
        [review] = await tx
          .update(reviews)
          .set({
            ...identity,
            name: reviewName,
            rating: input.rating,
            url: input.url,
            updatedAt: sql`NOW()`,
          })
          .where(eq(reviews.id, existingReview.id))
          .returning();
      } else {
        const { rows } = await tx.execute(
          // New rows carry only direct Bottle identity. Conflict updates retain
          // legacy release/target evidence and apply Bottle identity by CAS.
          sql`INSERT INTO ${reviews} (target_id, bottle_id, release_id, external_site_id, name, issue, rating, url)
              VALUES (NULL, ${bottleId}, NULL, ${site.id}, ${reviewName}, ${input.issue}, ${input.rating}, ${input.url})
              ON CONFLICT (external_site_id, LOWER(name), issue)
              DO UPDATE
              SET bottle_id = CASE
                    WHEN excluded.bottle_id IS NOT NULL
                      AND (${reviews.bottleId} IS NULL OR ${reviews.bottleId} = excluded.bottle_id)
                    THEN excluded.bottle_id
                    ELSE ${reviews.bottleId}
                  END,
                  rating = excluded.rating,
                  url = excluded.url,
                  updated_at = NOW()
              RETURNING *`,
        );

        [review] = mapRows(rows, reviews);
      }

      const appliedIncomingIdentity = review.bottleId === bottleId;
      if (!bottleId || !appliedIncomingIdentity) {
        return { review, aliasAssignment: null };
      }

      const assignmentSource =
        resolution.source === "exact_alias"
          ? undefined
          : ("classifier_approved" as const);
      if (!lockedAssignment) {
        throw new Error("Bottle resolution returned no locked assignment.");
      }
      const aliasInput = {
        name: aliasKey,
        backfillNames: [reviewName, rawName],
        externalSiteId: site.id,
        assignmentSource,
        assignedByActorId: systemActor.id,
      };
      const aliasAssignment = await assignBottleAliasInTransaction(tx, {
        bottleId,
        sourceAliasIdentity: resolution.sourceAliasIdentity,
        ...aliasInput,
      });

      const decision = getIncomingBottleDecisionFromResolutionSource(
        resolution.source,
        { createdBottle: resolution.createdBottle },
      );
      if (
        decision !== null &&
        shouldRecordIncomingBottleDecision({
          previousBottleId: existingReview?.bottleId,
          bottleId,
          decision,
        })
      ) {
        await recordIncomingBottleDecisionInTransaction(tx, {
          sourceKind: "review",
          sourceId: review.id,
          externalSiteId: site.id,
          name: reviewName,
          url: input.url,
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
            issue: input.issue,
            initiatedByUserId: context.user!.id,
          },
        });
      }

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
