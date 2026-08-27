import {
  normalizeBottle,
  normalizeBottleAliasKey,
} from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import { externalSites } from "@peated/server/db/schema";
import { storeExternalReviewArticleInTransaction } from "@peated/server/externalReviews/store";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import {
  assignBottleAliasInTransaction,
  finalizeBottleAliasAssignment,
} from "@peated/server/lib/bottleAliases";
import {
  resolveBottleReferenceTarget,
  resolveScrapedBottleReferenceTarget,
} from "@peated/server/lib/bottleReferenceResolution";
import { dispatchBottleStatsRecompute } from "@peated/server/lib/dispatchBottleStatsRecompute";
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
import { ExternalReviewInputSchema } from "@peated/server/schemas";
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
      const result = await storeExternalReviewArticleInTransaction(
        tx,
        {
          externalSiteId: site.id,
          canonicalUrl: input.url,
          title: null,
          issue: input.issue,
          publishedAt: null,
          contentHash: null,
          fetchedAt: null,
          externalReviews: [
            {
              sourceKey,
              name: reviewName,
              category: input.category,
              reviewerName: null,
              nativeScore: input.nativeScore,
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
      const storedExternalReview = result.storedExternalReviews[0];
      if (!storedExternalReview) {
        throw new Error("Unable to store external review.");
      }
      const { previousBottleId, externalReview } = storedExternalReview;

      const appliedIncomingIdentity = externalReview.bottleId === bottleId;
      if (!bottleId || !appliedIncomingIdentity) {
        return { externalReview, previousBottleId, aliasAssignment: null };
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
          sourceId: externalReview.id,
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

      return { externalReview, previousBottleId, aliasAssignment };
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

  await Promise.all(
    Array.from(
      new Set(
        [stored.previousBottleId, stored.externalReview.bottleId].filter(
          (id): id is number => id !== null && id !== undefined,
        ),
      ),
    ).map((bottleId) =>
      dispatchBottleStatsRecompute(
        "externalReview",
        stored.externalReview.id,
        bottleId,
      ),
    ),
  );

  return stored.externalReview;
}
