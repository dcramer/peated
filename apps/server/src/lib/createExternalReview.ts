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
import { resolveBottleReferenceTarget } from "@peated/server/lib/bottleReferenceResolution";
import { mapRows } from "@peated/server/lib/db";
import { ExternalSiteNotFoundError } from "@peated/server/lib/externalSites";
import {
  getIncomingBottleDecisionFromResolutionSource,
  recordIncomingBottleDecisionInTransaction,
  shouldRecordIncomingBottleDecision,
} from "@peated/server/lib/incomingBottleDecisionLog";
import { logError } from "@peated/server/lib/log";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { ReviewInputSchema } from "@peated/server/schemas";
import { and, eq, or, sql } from "drizzle-orm";

/**
 * Owns external-review ingestion and Bottle identity assignment. Both API and
 * worker callers use Peated attribution, and provider input is parsed before
 * classification or persistence.
 */

export class ExternalReviewBottleStateError extends Error {
  readonly bottleId: number;
  readonly reason: ActiveBottleSelectionError["reason"];

  constructor(readonly selectionError: ActiveBottleSelectionError) {
    const { bottleId, reason } = selectionError;
    super(
      reason === "missing"
        ? "Bottle not found."
        : reason === "bottle_retired"
          ? `Bottle ${bottleId} is retired.`
          : `Bottle ${bottleId} is not active.`,
      { cause: selectionError },
    );
    this.name = "ExternalReviewBottleStateError";
    this.bottleId = bottleId;
    this.reason = reason;
  }
}

export const ExternalReviewInputSchema = ReviewInputSchema.strict();

export async function createExternalReview(
  rawInput: unknown,
  { initiatedByUserId }: { initiatedByUserId?: number } = {},
) {
  const input = ExternalReviewInputSchema.parse(rawInput);
  const systemActor = await getPeatedSystemActor();
  const site = await db.query.externalSites.findFirst({
    where: eq(externalSites.type, input.site),
  });
  if (!site) throw new ExternalSiteNotFoundError(input.site);

  const rawName = input.name;
  const { name: normalizedName } = normalizeBottle({ name: rawName });
  const aliasKey = normalizeBottleAliasKey(rawName);
  const resolution = await resolveBottleReferenceTarget({
    reference: {
      externalSiteId: site.id,
      name: rawName,
      url: input.url,
      imageUrl: null,
      currentBottleId: null,
    },
    aliasLookupNames: [aliasKey, rawName],
    extractedIdentity: { category: input.category },
    createdByActorId: systemActor.id,
  });
  if (resolution.error) {
    logError(resolution.error, {
      review: { site: input.site, name: rawName, url: input.url },
    });
  }
  const bottleId = resolution.assignment?.bottleId ?? null;
  const reviewName = normalizedName;
  const reviewNameCandidates = [reviewName.toLowerCase()];

  const { review, aliasAssignment } = await db.transaction(async (tx) => {
    if (bottleId !== null) {
      try {
        await resolveActiveBottleIds(tx, [bottleId], { lock: "update" });
      } catch (error) {
        if (!(error instanceof ActiveBottleSelectionError)) throw error;
        throw new ExternalReviewBottleStateError(error);
      }
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
      [review] = await tx
        .update(reviews)
        .set({
          bottleId: incomingIdentityIsAuthoritative
            ? bottleId
            : existingReview.bottleId,
          name: reviewName,
          rating: input.rating,
          url: input.url,
          updatedAt: sql`NOW()`,
        })
        .where(eq(reviews.id, existingReview.id))
        .returning();
    } else {
      const { rows } = await tx.execute(
        sql`INSERT INTO ${reviews} (bottle_id, external_site_id, name, issue, rating, url)
            VALUES (${bottleId}, ${site.id}, ${reviewName}, ${input.issue}, ${input.rating}, ${input.url})
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

    const aliasAssignment = await assignBottleAliasInTransaction(tx, {
      bottleId,
      name: aliasKey,
      backfillNames: [reviewName, rawName],
      externalSiteId: site.id,
      assignmentSource:
        resolution.source === "exact_alias" ? undefined : "classifier_approved",
      assignedByActorId: systemActor.id,
      sourceAliasIdentity: resolution.sourceAliasIdentity,
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
            ? { classifierEvidence: resolution.classifierEvidence }
            : {}),
          issue: input.issue,
          ...(initiatedByUserId === undefined ? {} : { initiatedByUserId }),
        },
      });
    }

    return { review, aliasAssignment };
  });

  if (aliasAssignment) {
    await finalizeBottleAliasAssignment(aliasAssignment, {
      review: { site: input.site, name: reviewName, url: input.url },
    });
  }

  await db
    .update(externalSites)
    .set({ lastRunAt: sql`NOW()` })
    .where(eq(externalSites.id, site.id));

  return review;
}
