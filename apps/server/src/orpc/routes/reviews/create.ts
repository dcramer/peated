import {
  normalizeBottle,
  normalizeBottleAliasKey,
} from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import { externalSites, reviews } from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import {
  assignBottleAliasInTransaction,
  finalizeBottleAliasAssignment,
} from "@peated/server/lib/bottleAliases";
import { resolveBottleReferenceTarget } from "@peated/server/lib/bottleReferenceResolution";
import {
  isStagedTargetlessCatalogMappingError,
  lockCatalogTargetAssignmentDescriptorInTransaction,
  resolveCatalogTargetForAssignment,
  type CatalogTargetAssignmentDescriptor,
} from "@peated/server/lib/catalogTargets";
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

const classifierCreateResolutionSources = [
  "classifier_create_bottle",
  "classifier_create_release",
  "classifier_create_bottle_and_release",
  "classifier_repair_parent_and_create_release",
] as const;

type ClassifierCreateResolutionSource =
  (typeof classifierCreateResolutionSources)[number];

function isClassifierCreateResolutionSource(
  source: string,
): source is ClassifierCreateResolutionSource {
  return classifierCreateResolutionSources.some((value) => value === source);
}

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
    const bottleId = resolution.bottleId;
    const releaseId = resolution.releaseId;
    const classifierCreateSource = isClassifierCreateResolutionSource(
      resolution.source,
    )
      ? resolution.source
      : null;
    const reviewName =
      (resolution.releaseId != null ||
        classifierCreateSource === "classifier_create_release" ||
        classifierCreateSource === "classifier_create_bottle_and_release" ||
        classifierCreateSource ===
          "classifier_repair_parent_and_create_release") &&
      rawName !== normalizedName
        ? rawName
        : normalizedName;
    const reviewNameCandidates = Array.from(
      new Set([reviewName.toLowerCase(), normalizedName.toLowerCase()]),
    );

    const { review, aliasAssignment } = await db.transaction(async (tx) => {
      let target: CatalogTargetAssignmentDescriptor | null = null;
      if (resolution.targetId !== null) {
        target = await resolveCatalogTargetForAssignment(
          { kind: "target", targetId: resolution.targetId },
          tx,
        );
      } else if (bottleId !== null && resolution.source === "exact_alias") {
        try {
          target = await resolveCatalogTargetForAssignment(
            {
              kind: "legacy",
              bottleId,
              releaseId,
              context: {
                caller: "reviews.create",
                operation: "reuseTargetlessExactReviewAlias",
              },
            },
            tx,
          );
        } catch (error) {
          if (!isStagedTargetlessCatalogMappingError(error)) throw error;
        }
      } else if (
        bottleId !== null &&
        resolution.source === "classifier_match"
      ) {
        target = await resolveCatalogTargetForAssignment(
          {
            kind: "legacy",
            bottleId,
            releaseId,
            context: {
              caller: "reviews.create",
              operation: "create",
            },
          },
          tx,
        );
      }

      if (classifierCreateSource !== null) {
        if (bottleId === null || releaseId !== null || target === null) {
          throw new Error(
            "Classifier concrete Bottle creation returned an incomplete target identity.",
          );
        }
        if (target.bottleId !== bottleId) {
          throw new Error(
            "Classifier concrete Bottle creation returned a non-exact or mismatched target.",
          );
        }
      }
      if (target) {
        await lockCatalogTargetAssignmentDescriptorInTransaction(tx, target);
      }

      // Preserve or replace identity only from the Review version locked after
      // the catalog target, keeping the catalog-before-consumer lock order.
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
        const classifierCreateConflictsWithDurableIdentity =
          classifierCreateSource !== null &&
          target !== null &&
          existingReview.targetId !== null &&
          existingReview.targetId !== target.targetId;
        const incomingIdentityIsAuthoritative =
          !classifierCreateConflictsWithDurableIdentity &&
          (target !== null ||
            (bottleId !== null && existingReview.targetId === null));
        const identity = incomingIdentityIsAuthoritative
          ? {
              targetId: target?.targetId ?? null,
              bottleId,
              releaseId,
            }
          : {
              targetId: existingReview.targetId,
              bottleId: existingReview.bottleId,
              releaseId: existingReview.releaseId,
            };
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
          // Every CASE uses the same authority test so conflict handling either
          // selects or preserves the complete target/Bottle/Release tuple.
          sql`INSERT INTO ${reviews} (target_id, bottle_id, release_id, external_site_id, name, issue, rating, url)
              VALUES (${target?.targetId ?? null}, ${bottleId}, ${releaseId}, ${site.id}, ${reviewName}, ${input.issue}, ${input.rating}, ${input.url})
              ON CONFLICT (external_site_id, LOWER(name), issue)
              DO UPDATE
              SET target_id = CASE
                    WHEN (excluded.target_id IS NOT NULL
                        AND (${classifierCreateSource === null} OR ${reviews.targetId} IS NULL))
                      OR (excluded.bottle_id IS NOT NULL AND ${reviews.targetId} IS NULL)
                    THEN excluded.target_id
                    ELSE ${reviews.targetId}
                  END,
                  bottle_id = CASE
                    WHEN (excluded.target_id IS NOT NULL
                        AND (${classifierCreateSource === null} OR ${reviews.targetId} IS NULL))
                      OR (excluded.bottle_id IS NOT NULL AND ${reviews.targetId} IS NULL)
                    THEN excluded.bottle_id
                    ELSE ${reviews.bottleId}
                  END,
                  release_id = CASE
                    WHEN (excluded.target_id IS NOT NULL
                        AND (${classifierCreateSource === null} OR ${reviews.targetId} IS NULL))
                      OR (excluded.bottle_id IS NOT NULL AND ${reviews.targetId} IS NULL)
                    THEN excluded.release_id
                    ELSE ${reviews.releaseId}
                  END,
                  rating = excluded.rating,
                  url = excluded.url,
                  updated_at = NOW()
              RETURNING *`,
        );

        [review] = mapRows(rows, reviews);
      }

      const appliedIncomingIdentity =
        review.targetId === (target?.targetId ?? null) &&
        review.bottleId === bottleId &&
        review.releaseId === releaseId;
      if (!bottleId || !appliedIncomingIdentity) {
        return { review, aliasAssignment: null };
      }

      const assignmentSource =
        resolution.source === "exact_alias"
          ? undefined
          : ("classifier_approved" as const);
      const aliasAssignment = await assignBottleAliasInTransaction(
        tx,
        target
          ? {
              target,
              consumerIdentity: { bottleId, releaseId },
              name: aliasKey,
              backfillNames: [reviewName, rawName],
              externalSiteId: site.id,
              assignmentSource,
              assignedByActorId: systemActor.id,
            }
          : {
              bottleId,
              releaseId,
              context: {
                caller: "reviews.create",
                operation:
                  resolution.source === "exact_alias"
                    ? "reuseExactReviewAlias"
                    : "assignResolvedReviewAlias",
              },
              name: aliasKey,
              backfillNames: [reviewName, rawName],
              externalSiteId: site.id,
              assignmentSource,
              assignedByActorId: systemActor.id,
            },
      );

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
          releaseId,
          targetId: target?.targetId ?? null,
          createdBottle: resolution.createdBottle,
          createdRelease: resolution.createdRelease,
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
