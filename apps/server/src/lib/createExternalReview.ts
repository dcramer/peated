import {
  normalizeBottle,
  normalizeBottleAliasKey,
} from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import { storeReviewArticleInTransaction } from "@peated/server/externalReviews/store";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import {
  assignBottleAliasInTransaction,
  finalizeBottleAliasAssignment,
} from "@peated/server/lib/bottleAliases";
import {
  resolveBottleReferenceTarget,
  resolveScrapedBottleReferenceTarget,
} from "@peated/server/lib/bottleReferenceResolution";
import { ExternalSiteNotFoundError } from "@peated/server/lib/externalSites";
import {
  getIncomingBottleDecisionFromResolutionSource,
  recordIncomingBottleDecisionInTransaction,
  shouldRecordIncomingBottleDecision,
  type IncomingBottleDecisionMetadata,
} from "@peated/server/lib/incomingBottleDecisionLog";
import { logError } from "@peated/server/lib/log";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { ReviewInputSchema } from "@peated/server/schemas";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";

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

type ExternalReviewContext =
  | { initiatedByUserId: number }
  | { externalSiteId: number; sourceKey: string };

export type ExternalReviewServices = {
  classifyReference?: NonNullable<
    Parameters<typeof resolveBottleReferenceTarget>[1]
  >;
  classifyScrapedReference?: NonNullable<
    Parameters<typeof resolveScrapedBottleReferenceTarget>[1]
  >;
};

export async function createExternalReview(
  rawInput: z.input<typeof ExternalReviewInputSchema>,
  context: ExternalReviewContext,
  services: ExternalReviewServices = {},
) {
  const input = ExternalReviewInputSchema.parse(rawInput);
  const initiatedByUserId =
    "initiatedByUserId" in context ? context.initiatedByUserId : undefined;
  const sourceKey = "sourceKey" in context ? context.sourceKey : input.url;
  const systemActor = await getPeatedSystemActor();
  const site = await db.query.externalSites.findFirst({
    where:
      "externalSiteId" in context
        ? and(
            eq(externalSites.id, context.externalSiteId),
            eq(externalSites.type, input.site),
          )
        : eq(externalSites.type, input.site),
  });
  if (!site) throw new ExternalSiteNotFoundError(input.site);

  const rawName = input.name;
  const { name: normalizedName } = normalizeBottle({ name: rawName });
  const aliasKey = normalizeBottleAliasKey(rawName);
  const referenceInput = {
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
  };
  const resolution =
    initiatedByUserId === undefined
      ? await resolveScrapedBottleReferenceTarget(
          referenceInput,
          services.classifyScrapedReference,
        )
      : await resolveBottleReferenceTarget(
          referenceInput,
          services.classifyReference,
        );
  if (resolution.error) {
    logError(resolution.error, {
      review: { site: input.site, name: rawName, url: input.url },
    });
  }
  const bottleId = resolution.assignment?.bottleId ?? null;
  const reviewName = normalizedName;

  let stored;
  try {
    stored = await db.transaction(async (tx) => {
      const result = await storeReviewArticleInTransaction(
        tx,
        {
          externalSiteId: site.id,
          canonicalUrl: input.url,
          title: null,
          issue: input.issue,
          publishedAt: null,
          contentHash: null,
          fetchedAt: null,
          reviews: [
            {
              sourceKey,
              name: reviewName,
              category: input.category,
              reviewerName: null,
              nativeScore: null,
              normalizedRating: input.rating,
              bottleId,
              summary: null,
            },
          ],
        },
        {
          origin: "manual",
          invalidBottleAction: "reject",
          aliasLookupNames:
            bottleId === null ? [] : [aliasKey, reviewName, rawName],
        },
      );
      const storedReview = result.storedReviews[0];
      if (!storedReview) throw new Error("Unable to store review.");
      const { previousBottleId, review } = storedReview;

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
          resolution.source === "exact_alias"
            ? undefined
            : "classifier_approved",
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
          previousBottleId,
          bottleId,
          decision,
        })
      ) {
        const metadata: IncomingBottleDecisionMetadata = {
          resolutionSource: resolution.source,
          issue: input.issue,
        };
        if (resolution.classifierEvidence) {
          metadata.classifierEvidence = resolution.classifierEvidence;
        }
        if (initiatedByUserId !== undefined) {
          metadata.initiatedByUserId = initiatedByUserId;
        }
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
          metadata,
        });
      }

      return { review, aliasAssignment };
    });
  } catch (error) {
    if (error instanceof ActiveBottleSelectionError) {
      throw new ExternalReviewBottleStateError(error);
    }
    throw error;
  }

  if (stored.aliasAssignment) {
    await finalizeBottleAliasAssignment(stored.aliasAssignment, {
      review: { site: input.site, name: reviewName, url: input.url },
    });
  }

  return stored.review;
}
