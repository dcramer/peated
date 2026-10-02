import type { BottleReferenceRun } from "@peated/bottle-classifier";
import {
  type BottleClassificationResult,
  type CandidateExpansionMode,
  type ClassifyBottleReferenceInput,
} from "@peated/bottle-classifier/contract";
import {
  BottleCandidateSchema,
  BottleExtractedDetailsSchema,
  type BottleCandidate,
  type BottleExtractedDetails,
} from "@peated/bottle-classifier/internal/types";
import type { CatalogVerificationCreationSource } from "@peated/catalog-verifier";
import {
  BottleClassificationError,
  isIgnoredBottleClassification,
  type BottleClassificationDecision,
} from "@peated/server/agents/bottleClassifier";
import { runScrapedBottleReference } from "@peated/server/agents/bottleClassifier/scrapedBottleReference";
import config from "@peated/server/config";
import { db, type AnyDatabase, type AnyTransaction } from "@peated/server/db";
import {
  actors,
  bottleBarcodes,
  bottleObservations,
  bottleReferences,
  bottles,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  storePrices,
  type StorePrice,
  type StorePriceMatchProposal,
  type User,
} from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import { createBottleCheck } from "@peated/server/lib/bottleChecks";
import { assessBottleResolution } from "@peated/server/lib/bottleMatchingAutomation";
import {
  assignBottleReferenceInTransaction,
  fillMissingBottleImage,
  finalizeBottleReferenceAssignment,
} from "@peated/server/lib/bottleReferences";
import type { BottleCreateInput } from "@peated/server/lib/bottleSchemas";
import { buildClassifierBottleInput } from "@peated/server/lib/classifierDecisionCreateInputs";
import {
  createOrReuseBottleInTransaction,
  finalizeCreatedBottle,
} from "@peated/server/lib/createBottle";
import { normalizeGtin } from "@peated/server/lib/gtin";
import {
  recordIncomingBottleDecisionInTransaction,
  type IncomingBottleDecisionActor,
  type IncomingBottleDecisionMetadata,
  type IncomingBottleDecisionType,
} from "@peated/server/lib/incomingBottleDecisionLog";
import { logError, logInfo } from "@peated/server/lib/log";
import { normalizeBottleReferenceKey } from "@peated/server/lib/normalize";
import { isModelServiceUnavailable } from "@peated/server/lib/openaiClient";
import {
  hasActiveStorePriceMatchProposalProcessingLease,
  refreshStorePriceMatchProposalProcessingLease,
  releaseStorePriceMatchProposalProcessingLease,
} from "@peated/server/lib/priceMatchingProcessingLease";
import {
  REVIEWABLE_STORE_PRICE_MATCH_PROPOSAL_STATUSES,
  toCurrentProposalStatus,
  toCurrentProposalType,
} from "@peated/server/lib/priceMatchingStatus";
import { resolveActiveBottleIds } from "@peated/server/lib/resolveActiveBottleIds";
import { resolveStorePriceBottleMatchInTransaction } from "@peated/server/lib/storePriceBottleMatching";
import { currentStorePriceCondition } from "@peated/server/lib/storePriceValidity";
import { getAutomationModeratorUser } from "@peated/server/lib/systemUser";
import type {
  PriceMatchSearchEvidenceSchema,
  StorePriceMatchAutomationAssessment,
} from "@peated/server/schemas";
import {
  ProposedBottleSchema,
  StorePriceMatchDecisionSchema,
} from "@peated/server/schemas";
import { pushUniqueJob } from "@peated/server/worker/dispatch";
import { and, eq, inArray, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import type { z } from "zod";

type ExtractedBottleDetails = BottleExtractedDetails;
type PriceMatchCandidate = BottleCandidate;
type SearchEvidence = z.infer<typeof PriceMatchSearchEvidenceSchema>;
type ProposedBottle = z.infer<typeof ProposedBottleSchema>;
type StorePriceMatchDecision = z.infer<typeof StorePriceMatchDecisionSchema>;
type StorePriceMatchProposalForReview = StorePriceMatchProposal & {
  price: StorePrice;
};

async function getPriceMatchWriteActorForDatabase(
  tx: AnyDatabase,
  actor: IncomingBottleDecisionActor,
  {
    userId,
    allowSystemActor = false,
  }: {
    userId: number;
    allowSystemActor?: boolean;
  },
): Promise<IncomingBottleDecisionActor> {
  const storedActor = await tx.query.actors.findFirst({
    where: eq(actors.id, actor.id),
  });

  if (!storedActor || storedActor.type !== actor.type) {
    throw new Error(`Invalid price match actor ${actor.id}.`);
  }

  if (storedActor.type === "system") {
    if (!allowSystemActor) {
      throw new Error(`System actor ${actor.id} is not allowed here.`);
    }
    return storedActor;
  }

  if (storedActor.userId !== userId) {
    throw new Error(`User actor ${actor.id} does not match user ${userId}.`);
  }

  return storedActor;
}

function parseClassifierProposedBottle(
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>,
): ProposedBottle;
function parseClassifierProposedBottle(
  proposedBottle: BottleClassificationDecision["proposedBottle"],
): ProposedBottle | null;
function parseClassifierProposedBottle(
  proposedBottle: BottleClassificationDecision["proposedBottle"],
): ProposedBottle | null {
  return proposedBottle ? ProposedBottleSchema.parse(proposedBottle) : null;
}

function parseClassifierExtractedLabel(
  extractedLabel: ClassifyBottleReferenceInput["extractedIdentity"],
): ExtractedBottleDetails | null {
  return extractedLabel
    ? BottleExtractedDetailsSchema.parse(extractedLabel)
    : null;
}

function parseClassifierCandidates(
  candidates: unknown[],
): PriceMatchCandidate[] {
  return candidates.map((candidate) => BottleCandidateSchema.parse(candidate));
}

function parseStoredExtractedLabel(
  proposal: StorePriceMatchProposal | null | undefined,
): ExtractedBottleDetails | null {
  if (!proposal?.extractedLabel) {
    return null;
  }

  const parsed = BottleExtractedDetailsSchema.safeParse(
    proposal.extractedLabel,
  );
  return parsed.success ? parsed.data : null;
}

export class UnknownStorePriceMatchProposalError extends Error {
  constructor(proposalId: number) {
    super(`Price match proposal not found (${proposalId}).`);
    this.name = "UnknownStorePriceMatchProposalError";
  }
}

export class StorePriceMatchProposalNotReviewableError extends Error {
  constructor(
    readonly proposalId: number,
    readonly status: StorePriceMatchProposal["status"],
  ) {
    super(`Price match proposal is not reviewable (${proposalId}, ${status}).`);
    this.name = "StorePriceMatchProposalNotReviewableError";
  }
}

export class StorePriceMatchProposalIdentityChangedError extends Error {
  constructor(readonly proposalId: number) {
    super(
      `Price match proposal identity changed during approval (${proposalId}).`,
    );
    this.name = "StorePriceMatchProposalIdentityChangedError";
  }
}

/**
 * Converts classifier decisions into store-price match decisions while carrying
 * review metadata needed by later proposal handling.
 */
export function toStorePriceMatchDecision({
  price,
  decision,
}: {
  price: Pick<StorePrice, "bottleId">;
  decision: BottleClassificationDecision;
}): StorePriceMatchDecision {
  if (decision.action === "match") {
    return {
      action: "match",
      rationale: decision.rationale,
      candidateBottleIds: decision.candidateBottleIds,
      identityScope: decision.identityScope,
      referenceScope: decision.referenceScope ?? "none",
      suggestedBottleId: decision.matchedBottleId,
      proposedBottle: null,
    };
  }

  if (decision.action === "create_bottle") {
    return {
      action: "create_bottle",
      rationale: decision.rationale,
      candidateBottleIds: decision.candidateBottleIds,
      identityScope: decision.identityScope,
      referenceScope: decision.referenceScope ?? "none",
      suggestedBottleId: null,
      proposedBottle: parseClassifierProposedBottle(decision.proposedBottle),
    };
  }

  return {
    action: "no_match",
    rationale: decision.rationale,
    candidateBottleIds: decision.candidateBottleIds,
    identityScope: decision.identityScope,
    referenceScope: decision.referenceScope ?? "none",
    suggestedBottleId: null,
    proposedBottle: null,
  };
}

export class StorePriceMatchProposalAlreadyProcessingError extends Error {
  constructor(readonly proposalId: number) {
    super(`Price match proposal is currently processing (${proposalId}).`);
    this.name = "StorePriceMatchProposalAlreadyProcessingError";
  }
}

export class InvalidStorePriceMatchProposalTypeError extends Error {
  constructor(
    readonly proposalId: number,
    readonly proposalType: StorePriceMatchProposal["proposalType"],
    readonly expectedProposalTypes: readonly StorePriceMatchProposal["proposalType"][],
  ) {
    const expected = expectedProposalTypes.join(" or ");
    super(
      `Price match proposal has invalid type (${proposalId}, expected ${expected}, got ${proposalType}).`,
    );
    this.name = "InvalidStorePriceMatchProposalTypeError";
  }
}

function shouldTrackStorePriceQueueEntry(
  status: StorePriceMatchProposal["status"],
  automationEligible: boolean,
) {
  // An eligible decision is applied right away and never waits for a person.
  return (
    (status === "pending_review" && !automationEligible) || status === "errored"
  );
}

function getInitialAttemptFinalStatus(
  status: StorePriceMatchProposal["status"],
): StorePriceMatchProposal["status"] | null {
  return status === "pending_review" ? null : status;
}

async function recordStorePriceMatchAttempt({
  automationAssessment,
  proposal,
  tx = db,
}: {
  automationAssessment?: StorePriceMatchAutomationAssessment | null;
  proposal: StorePriceMatchProposal;
  tx?: AnyDatabase;
}) {
  const [attempt] = await tx
    .insert(storePriceMatchAttempts)
    .values({
      priceId: proposal.priceId,
      proposalId: proposal.id,
      proposalType: proposal.proposalType,
      initialStatus: proposal.status,
      finalStatus: getInitialAttemptFinalStatus(proposal.status),
      confidence: proposal.confidence,
      currentBottleId: proposal.currentBottleId,
      suggestedBottleId: proposal.suggestedBottleId,
      automationEligible: automationAssessment?.automationEligible ?? false,
      model: proposal.model,
      error: proposal.error,
      reviewedById: proposal.reviewedById,
      reviewedAt: proposal.reviewedAt,
    })
    .returning();

  if (!attempt) {
    throw new Error(
      `Unable to record price match attempt for proposal (${proposal.id}).`,
    );
  }

  return attempt;
}

async function persistStorePriceBottleCheck({
  attemptId,
  classificationInput,
  classification,
  database,
  model,
  modelMetadata,
  priceId,
}: {
  attemptId: number;
  classificationInput: ClassifyBottleReferenceInput;
  classification: BottleClassificationResult;
  database: AnyDatabase;
  model: StorePriceMatchProposal["model"];
  modelMetadata: BottleReferenceRun["modelMetadata"];
  priceId: number;
}) {
  await createBottleCheck(
    {
      intent: "resolve_reference",
      sourceKind: "store_price",
      sourceId: priceId,
      input: classificationInput,
      result: classification,
      storePrice: {
        attemptId,
      },
      model,
      modelMetadata,
    },
    database,
  );
}

async function markLatestStorePriceMatchAttemptFinalInTransaction(
  tx: AnyDatabase,
  {
    proposalId,
    finalStatus,
    reviewedById,
    error,
    assignment,
  }: {
    proposalId: number;
    finalStatus: StorePriceMatchProposal["status"];
    reviewedById?: number | null;
    error?: string | null;
    assignment?: {
      bottleId: number;
    };
  },
) {
  await tx.execute(sql`
    UPDATE ${storePriceMatchAttempts}
    SET
      final_status = ${finalStatus},
      reviewed_by_id = ${reviewedById ?? null},
      error = COALESCE(${error ?? null}, error),
      current_bottle_id = CASE
        WHEN ${assignment !== undefined} THEN ${assignment?.bottleId ?? null}
        ELSE current_bottle_id
      END,
      suggested_bottle_id = CASE
        WHEN ${assignment !== undefined} THEN ${assignment?.bottleId ?? null}
        ELSE suggested_bottle_id
      END,
      reviewed_at = NOW(),
      updated_at = NOW()
    WHERE id = (
      SELECT id
      FROM ${storePriceMatchAttempts}
      WHERE proposal_id = ${proposalId}
      ORDER BY id DESC
      LIMIT 1
    )
  `);
}

async function markOwnedStorePriceMatchAttemptFinalInTransaction(
  tx: AnyDatabase,
  {
    attemptId,
    proposalId,
    expectedProcessingToken,
    finalStatus,
    reviewedById,
    error,
  }: {
    attemptId: number;
    proposalId: number;
    expectedProcessingToken?: string;
    finalStatus: StorePriceMatchProposal["status"];
    reviewedById?: number | null;
    error?: string | null;
  },
) {
  await tx
    .update(storePriceMatchAttempts)
    .set({
      finalStatus,
      reviewedById: reviewedById ?? null,
      error: error ?? null,
      reviewedAt: sql`NOW()`,
      updatedAt: sql`NOW()`,
    })
    .where(
      and(
        eq(storePriceMatchAttempts.id, attemptId),
        eq(storePriceMatchAttempts.proposalId, proposalId),
        expectedProcessingToken
          ? sql`EXISTS (
              SELECT 1
              FROM ${storePriceMatchProposals}
              WHERE ${storePriceMatchProposals.id} = ${proposalId}
                AND ${storePriceMatchProposals.processingToken} = ${expectedProcessingToken}
                AND ${storePriceMatchProposals.processingExpiresAt} IS NOT NULL
                AND ${storePriceMatchProposals.processingExpiresAt} > NOW()
            )`
          : undefined,
      ),
    );
}

function getStorePriceQueueEntryUpdateValue(
  status: StorePriceMatchProposal["status"],
  automationEligible: boolean,
) {
  if (!shouldTrackStorePriceQueueEntry(status, automationEligible)) {
    return storePriceMatchProposals.enteredQueueAt;
  }

  return sql`CASE
    WHEN ${storePriceMatchProposals.status} IN ('pending_review', 'errored')
      THEN COALESCE(${storePriceMatchProposals.enteredQueueAt}, NOW())
    ELSE NOW()
  END`;
}

function shouldAutoCreateStorePriceMatchProposal({
  decision,
  automationAssessment,
}: {
  decision: StorePriceMatchDecision;
  automationAssessment: StorePriceMatchAutomationAssessment | null;
}) {
  return (
    decision.action === "create_bottle" &&
    decision.proposedBottle !== null &&
    automationAssessment?.automationEligible === true
  );
}

async function reloadStorePriceMatchProposal(
  proposalId: number,
): Promise<StorePriceMatchProposal> {
  const proposal = await db.query.storePriceMatchProposals.findFirst({
    where: eq(storePriceMatchProposals.id, proposalId),
  });

  if (!proposal) {
    throw new Error(`Unable to reload price match proposal (${proposalId}).`);
  }

  return proposal;
}

async function reloadStorePriceMatchProposalByPriceId(
  priceId: number,
  database: AnyDatabase,
): Promise<StorePriceMatchProposal> {
  const proposal = await database.query.storePriceMatchProposals.findFirst({
    where: eq(storePriceMatchProposals.priceId, priceId),
  });

  if (!proposal) {
    throw new Error(
      `Unable to reload price match proposal for price (${priceId}).`,
    );
  }

  return proposal;
}

export function canClearIgnoredStorePriceAssignment({
  proposal,
  processingToken,
}: {
  proposal: Pick<
    StorePriceMatchProposal,
    "processingToken" | "processingExpiresAt"
  >;
  processingToken?: string;
}) {
  if (!processingToken) {
    return true;
  }

  return (
    proposal.processingToken === processingToken &&
    hasActiveStorePriceMatchProposalProcessingLease(proposal)
  );
}

async function canContinueStorePriceMatchProcessing(
  proposalId: number,
  processingToken: string,
) {
  const proposal = await reloadStorePriceMatchProposal(proposalId);

  return (
    proposal.processingToken === processingToken &&
    hasActiveStorePriceMatchProposalProcessingLease(proposal)
  );
}

function buildStorePriceMatchBottleInput(
  decision: StorePriceMatchDecision,
): BottleCreateInput {
  if (decision.action !== "create_bottle" || decision.proposedBottle === null) {
    throw new Error(
      "Price match decision does not contain one Bottle creation input.",
    );
  }

  return buildClassifierBottleInput(decision.proposedBottle);
}

function buildStorePriceObservationFacts(
  proposal: Pick<
    StorePriceMatchProposalForReview,
    "referenceScope" | "proposalType" | "proposedBottle"
  >,
) {
  return {
    referenceScope: proposal.referenceScope ?? "none",
    proposalType: proposal.proposalType,
    proposedBottle: proposal.proposedBottle ?? null,
  };
}

async function upsertStorePriceObservationInTransaction(
  tx: AnyDatabase,
  {
    proposal,
    bottleId,
    createdById,
  }: {
    proposal: StorePriceMatchProposalForReview;
    bottleId: number;
    createdById: number;
  },
) {
  // Preserve the exact store listing as evidence even when the canonical reference
  // stays bottle-level. Approval should capture facts without forcing a split.
  const [observation] = await tx
    .insert(bottleObservations)
    .values({
      bottleId,
      sourceType: "store_price",
      sourceKey: `store_price:${proposal.price.id}`,
      sourceName: proposal.price.name,
      sourceUrl: proposal.price.url,
      externalSiteId: proposal.price.externalSiteId,
      rawText: proposal.price.name,
      parsedIdentity: proposal.extractedLabel ?? null,
      facts: buildStorePriceObservationFacts(proposal),
      createdById,
    })
    .onConflictDoUpdate({
      target: [bottleObservations.sourceType, bottleObservations.sourceKey],
      set: {
        bottleId,
        sourceName: proposal.price.name,
        sourceUrl: proposal.price.url,
        externalSiteId: proposal.price.externalSiteId,
        rawText: proposal.price.name,
        parsedIdentity: proposal.extractedLabel ?? null,
        facts: buildStorePriceObservationFacts(proposal),
        createdById,
        updatedAt: sql`NOW()`,
      },
    })
    .returning();

  return observation;
}

export async function upsertStorePriceMatchProposal({
  price,
  extractedLabel,
  candidates,
  decision,
  automationAssessment,
  searchEvidence,
  error,
  statusOverride,
  preserveExistingDecision = false,
  expectedProcessingToken,
  model,
  tx = db,
}: {
  price: StorePrice;
  extractedLabel: ExtractedBottleDetails | null;
  candidates: PriceMatchCandidate[];
  decision?: StorePriceMatchDecision | null;
  automationAssessment?: StorePriceMatchAutomationAssessment | null;
  searchEvidence?: SearchEvidence[];
  error?: string | null;
  statusOverride?: StorePriceMatchProposal["status"] | null;
  preserveExistingDecision?: boolean;
  expectedProcessingToken?: string;
  model?: string | null;
  tx?: AnyDatabase;
}) {
  const parsedDecision = decision
    ? StorePriceMatchDecisionSchema.parse(decision)
    : null;
  const proposalType = parsedDecision?.action ?? "no_match";
  const status =
    statusOverride ?? (parsedDecision ? "pending_review" : "errored");
  const automationEligible = automationAssessment?.automationEligible ?? false;
  const enteredQueueAt = shouldTrackStorePriceQueueEntry(
    status,
    automationEligible,
  )
    ? sql`NOW()`
    : null;
  const proposalRuntimeValues = {
    status,
    proposalType,
    currentBottleId: price.bottleId,
    suggestedBottleId: parsedDecision?.suggestedBottleId ?? null,
    referenceScope: parsedDecision?.referenceScope ?? null,
    candidateBottles: candidates,
    extractedLabel,
    proposedBottle: parsedDecision?.proposedBottle ?? null,
    searchEvidence: searchEvidence || [],
    automationAssessment: automationAssessment ?? null,
    rationale: parsedDecision?.rationale ?? null,
    model: model === undefined ? config.BOTTLE_CLASSIFIER_MODEL : model,
    error: error || null,
    lastEvaluatedAt: sql`NOW()`,
    enteredQueueAt,
    reviewedById: null,
    reviewedAt: null,
    updatedAt: sql`NOW()`,
  };
  const proposalValues = {
    ...proposalRuntimeValues,
    enteredQueueAt,
  };
  const updateValues =
    preserveExistingDecision && !parsedDecision
      ? {
          status,
          candidateBottles:
            candidates.length > 0
              ? candidates
              : sql`${storePriceMatchProposals.candidateBottles}`,
          extractedLabel:
            extractedLabel ?? sql`${storePriceMatchProposals.extractedLabel}`,
          searchEvidence:
            searchEvidence && searchEvidence.length > 0
              ? searchEvidence
              : sql`${storePriceMatchProposals.searchEvidence}`,
          model: model === undefined ? config.BOTTLE_CLASSIFIER_MODEL : model,
          error: error || null,
          lastEvaluatedAt: sql`NOW()`,
          enteredQueueAt: getStorePriceQueueEntryUpdateValue(
            status,
            automationEligible,
          ),
          reviewedById: null,
          reviewedAt: null,
          updatedAt: sql`NOW()`,
        }
      : {
          ...proposalRuntimeValues,
          enteredQueueAt: getStorePriceQueueEntryUpdateValue(
            status,
            automationEligible,
          ),
        };
  const [proposal] = await tx
    .insert(storePriceMatchProposals)
    .values({
      priceId: price.id,
      ...proposalValues,
    })
    .onConflictDoUpdate({
      target: storePriceMatchProposals.priceId,
      setWhere: expectedProcessingToken
        ? sql`${storePriceMatchProposals.processingToken} = ${expectedProcessingToken} AND ${storePriceMatchProposals.processingExpiresAt} IS NOT NULL AND ${storePriceMatchProposals.processingExpiresAt} > NOW()`
        : undefined,
      set: updateValues,
    })
    .returning();

  if (!proposal && expectedProcessingToken) {
    return await reloadStorePriceMatchProposalByPriceId(price.id, tx);
  }

  return proposal;
}

/** Conditionally clears the authoritative Bottle assignment snapshot. */
async function clearIgnoredStorePriceAssignmentInTransaction(
  tx: AnyDatabase,
  {
    priceId,
    expectedBottleId,
  }: {
    priceId: number;
    expectedBottleId: number | null;
  },
) {
  await tx
    .update(storePrices)
    .set({
      bottleId: null,
      matchedReferenceId: null,
      updatedAt: sql`NOW()`,
    })
    .where(
      and(
        eq(storePrices.id, priceId),
        sql`${storePrices.bottleId} IS NOT DISTINCT FROM ${expectedBottleId}`,
      ),
    );
}

async function createBottleFromStorePriceMatchProposalInTransaction(
  tx: AnyTransaction,
  {
    proposalId,
    bottleInput,
    user,
    creationSource,
    actor,
    expectedProcessingToken,
  }: {
    proposalId: number;
    bottleInput: BottleCreateInput;
    user: User;
    creationSource: CatalogVerificationCreationSource;
    actor: IncomingBottleDecisionActor;
    expectedProcessingToken?: string;
  },
) {
  const preflight = await getStorePriceMatchProposalPreflight(tx, proposalId);

  const writeActor = await getPriceMatchWriteActorForDatabase(tx, actor, {
    userId: user.id,
    allowSystemActor: creationSource === "price_match_automation",
  });

  const { createResult, bottle: resolvedBottle } =
    await createOrReuseBottleInTransaction(tx, {
      creationSource,
      createdByActorId: writeActor.id,
      input: bottleInput,
    });

  const proposal = await getStorePriceMatchProposalForReviewInTransaction(tx, {
    proposalId,
    expectedProposalTypes: ["create_bottle", "match", "no_match"],
    allowedStatuses: ["pending_review", "errored"],
    expectedProcessingToken,
  });
  if (
    proposal.priceId !== preflight.priceId ||
    proposal.price.bottleId !== preflight.price.bottleId ||
    !isDeepStrictEqual(proposal.proposedBottle, preflight.proposedBottle)
  ) {
    throw new StorePriceMatchProposalIdentityChangedError(proposalId);
  }

  const approval = await applyApprovedStorePriceMatchProposalInTransaction(tx, {
    proposal,
    reviewedById: user.id,
    allowSystemActor: creationSource === "price_match_automation",
    decisionLog: {
      actor: writeActor,
      decision: createResult ? "create_bottle" : "match",
      createdBottle: !!createResult,
      metadata: {
        creationSource,
        reusedExistingBottle: !createResult,
      },
    },
    bottleId: resolvedBottle.id,
  });

  return {
    createResult,
    approval,
    bottle: resolvedBottle,
  };
}

export async function createBottleFromStorePriceMatchProposal(
  {
    proposalId,
    bottleInput,
    user,
    creationSource = "price_match_review",
    actor,
    expectedProcessingToken,
  }: {
    proposalId: number;
    bottleInput: BottleCreateInput;
    user: User;
    creationSource?: CatalogVerificationCreationSource;
    actor: IncomingBottleDecisionActor;
    expectedProcessingToken?: string;
  },
  finalizeBottle: typeof finalizeCreatedBottle = finalizeCreatedBottle,
) {
  const result = await db.transaction(async (tx) =>
    createBottleFromStorePriceMatchProposalInTransaction(tx, {
      proposalId,
      bottleInput,
      user,
      creationSource,
      actor,
      expectedProcessingToken,
    }),
  );

  if (result.createResult) {
    await finalizeBottle(result.createResult, {
      creationSource,
    });
  }
  await finalizeStorePriceApproval(result.approval, result.bottle.id);

  return {
    bottle: result.bottle,
  };
}

function hasStorePriceMatchInputChanged(
  expected: StorePrice,
  current: StorePrice,
) {
  return (
    expected.name !== current.name ||
    expected.volume !== current.volume ||
    expected.barcode !== current.barcode ||
    !isDeepStrictEqual(
      expected.sourceBottleIdentity,
      current.sourceBottleIdentity,
    )
  );
}

/** Applies an approved barcode match without saving the store title as a reference. */
async function resolveApprovedBarcodeStorePriceMatch({
  price,
  existingProposal,
  processingToken,
}: {
  price: StorePrice;
  existingProposal: StorePriceMatchProposal | null | undefined;
  processingToken?: string;
}): Promise<StorePriceMatchProposal | null> {
  if (!price.barcode) return null;

  const normalizedBarcode = normalizeGtin(price.barcode);
  const barcodeMapping = await db.query.bottleBarcodes.findFirst({
    where: eq(bottleBarcodes.gtin14, normalizedBarcode.gtin14),
  });
  if (!barcodeMapping) return null;

  const [automationUser, systemActor] = await Promise.all([
    getAutomationModeratorUser(),
    getPeatedSystemActor(),
  ]);
  const result = await db.transaction(async (tx) => {
    const sourceBottleIdentity = price.sourceBottleIdentity
      ? BottleExtractedDetailsSchema.parse(price.sourceBottleIdentity)
      : null;
    const match = await resolveStorePriceBottleMatchInTransaction(tx, {
      name: price.name,
      normalizedBarcode,
      sourceBottleIdentity,
      volume: price.volume,
    });
    if (
      match.source !== "barcode" ||
      match.bottleId === null ||
      match.candidate === null
    ) {
      return null;
    }

    const [currentPrice] = await tx
      .select()
      .from(storePrices)
      .where(eq(storePrices.id, price.id))
      .limit(1)
      .for("update");
    if (!currentPrice) {
      throw new Error(`Unknown price ${price.id}`);
    }
    if (hasStorePriceMatchInputChanged(price, currentPrice)) {
      throw new Error(
        `Store price details changed during approved barcode matching (${price.id}).`,
      );
    }
    if (
      currentPrice.bottleId !== null &&
      currentPrice.bottleId !== match.bottleId
    ) {
      return null;
    }

    const decision: StorePriceMatchDecision = {
      action: "match",
      rationale: `Matched approved barcode ${normalizedBarcode.value}. Bottle size and known bottle details agree.`,
      candidateBottleIds: [match.bottleId],
      identityScope: "product",
      referenceScope: "none",
      suggestedBottleId: match.bottleId,
      proposedBottle: null,
    };
    const proposal = await upsertStorePriceMatchProposal({
      price: currentPrice,
      extractedLabel:
        sourceBottleIdentity ?? parseStoredExtractedLabel(existingProposal),
      candidates: [match.candidate],
      decision,
      searchEvidence: [],
      automationAssessment: {
        automationEligible: true,
        automationBlockers: [],
      },
      expectedProcessingToken: processingToken,
      model: null,
      tx,
    });
    if (
      processingToken &&
      (proposal.processingToken !== processingToken ||
        !hasActiveStorePriceMatchProposalProcessingLease(proposal))
    ) {
      return proposal.id;
    }

    await recordStorePriceMatchAttempt({ proposal, tx });
    const proposalForReview =
      await getStorePriceMatchProposalForReviewInTransaction(tx, {
        proposalId: proposal.id,
        allowedStatuses: ["pending_review"],
        expectedProcessingToken: processingToken,
      });
    const actor = await getPriceMatchWriteActorForDatabase(tx, systemActor, {
      userId: automationUser.id,
      allowSystemActor: true,
    });
    await persistApprovedStorePriceMatchInTransaction(tx, {
      proposal: proposalForReview,
      reviewedById: automationUser.id,
      bottleId: match.bottleId,
      decisionLog: {
        actor,
        decision: "match",
        metadata: {
          matchingBasis: "canonical_gtin",
          gtin14: normalizedBarcode.gtin14,
        },
      },
    });
    return proposal.id;
  });

  return result === null ? null : await reloadStorePriceMatchProposal(result);
}

/**
 * Owns full store-price classification persistence: the proposal, attempt, and
 * linked Bottle check commit together before any automated catalog mutation.
 */
export type StorePriceMatchResolverOptions = {
  candidateExpansion?: CandidateExpansionMode;
  force?: boolean;
  processingToken?: string;
  reuseExistingExtraction?: boolean;
  signal?: AbortSignal;
};

export type StorePriceReferenceRunner = typeof runScrapedBottleReference;
export type CreatedBottleFinalizer = typeof finalizeCreatedBottle;

export function createStorePriceMatchResolver({
  runReference = runScrapedBottleReference,
  finalizeBottle = finalizeCreatedBottle,
}: {
  runReference?: StorePriceReferenceRunner;
  finalizeBottle?: CreatedBottleFinalizer;
} = {}) {
  return async function resolveStorePriceMatchProposal(
    priceId: number,
    {
      candidateExpansion = "open",
      force = false,
      processingToken,
      reuseExistingExtraction = false,
      signal,
    }: StorePriceMatchResolverOptions = {},
  ) {
    const price = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, priceId),
    });

    if (!price) {
      throw new Error(`Unknown price ${priceId}`);
    }

    const existingProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.priceId, price.id),
    });
    // The proposal is the durable classification receipt. Automatic scraper and
    // image redispatches must not spend model work again; explicit retries own
    // reevaluation through force or a processing lease.
    if (existingProposal && !force && !processingToken) {
      logInfo("Skipped automatic store-price classification", {
        extra: {
          priceId: price.id,
          proposalId: existingProposal.id,
          proposalStatus: existingProposal.status,
        },
      });
      return existingProposal;
    }

    if (processingToken) {
      if (!existingProposal) {
        throw new Error(
          `Missing price match proposal for retry processing (${price.id}).`,
        );
      }

      if (
        existingProposal.processingToken !== processingToken ||
        !hasActiveStorePriceMatchProposalProcessingLease(existingProposal)
      ) {
        return existingProposal;
      }

      const refreshedLease =
        await refreshStorePriceMatchProposalProcessingLease({
          proposalId: existingProposal.id,
          processingToken,
        });

      if (!refreshedLease) {
        return await reloadStorePriceMatchProposal(existingProposal.id);
      }
    }

    let extractedLabel: ExtractedBottleDetails | null = null;
    let candidates: PriceMatchCandidate[] = [];
    let searchEvidence: SearchEvidence[] = [];
    let classificationModelMetadata: BottleReferenceRun["modelMetadata"] = null;
    try {
      const approvedBarcodeProposal =
        await resolveApprovedBarcodeStorePriceMatch({
          price,
          existingProposal,
          processingToken,
        });
      if (approvedBarcodeProposal) {
        return approvedBarcodeProposal;
      }

      // Price matching consumes the generic bottle classifier and only layers
      // price-specific persistence and automation policy on top of its result.
      const classificationInput: ClassifyBottleReferenceInput = {
        reference: {
          id: price.id,
          externalSiteId: price.externalSiteId,
          name: price.name,
          url: price.url ?? null,
          imageUrl: price.imageUrl ?? null,
          currentBottleId: price.bottleId ?? null,
        },
      };
      if (candidateExpansion !== "open") {
        classificationInput.candidateExpansion = candidateExpansion;
      }
      if (price.sourceBottleIdentity) {
        classificationInput.extractedIdentity =
          BottleExtractedDetailsSchema.parse(price.sourceBottleIdentity);
        classificationInput.extractedIdentitySource = "structured";
      } else if (reuseExistingExtraction) {
        // A reuse retry skips extraction only when saved facts exist. Passing
        // null would run the classifier with no facts at all.
        const storedIdentity = parseStoredExtractedLabel(existingProposal);
        if (storedIdentity) {
          classificationInput.extractedIdentity = storedIdentity;
        }
      }

      const classificationRun = signal
        ? await runReference(classificationInput, { signal })
        : await runReference(classificationInput);
      const classification = classificationRun.result;
      classificationModelMetadata = classificationRun.modelMetadata;

      extractedLabel = parseClassifierExtractedLabel(
        classification.artifacts.extractedIdentity,
      );
      candidates = parseClassifierCandidates(
        classification.artifacts.candidates,
      );
      searchEvidence = classification.artifacts.searchEvidence;

      if (isIgnoredBottleClassification(classification)) {
        const expectedBottleId = price.bottleId;
        const upsertIgnoredProposal = async (tx: AnyDatabase) =>
          await upsertStorePriceMatchProposal({
            price,
            extractedLabel,
            candidates,
            searchEvidence,
            statusOverride: "ignored",
            expectedProcessingToken: processingToken,
            tx,
          });
        const ignoredProposal = await db.transaction(async (tx) => {
          const proposal = await upsertIgnoredProposal(tx);
          const attempt = await recordStorePriceMatchAttempt({ proposal, tx });
          await persistStorePriceBottleCheck({
            attemptId: attempt.id,
            classificationInput,
            classification,
            database: tx,
            model: proposal.model,
            modelMetadata: classificationModelMetadata,
            priceId: price.id,
          });
          if (
            !canClearIgnoredStorePriceAssignment({ proposal, processingToken })
          ) {
            return proposal;
          }

          if (price.bottleId !== null) {
            await clearIgnoredStorePriceAssignmentInTransaction(tx, {
              priceId: price.id,
              expectedBottleId,
            });
          }

          return proposal;
        });
        return ignoredProposal;
      }

      // Check the classifier boundary: a Match must name a reviewed candidate.
      if (
        classification.decision.action === "match" &&
        !candidates.some(
          ({ bottleId }) =>
            bottleId === classification.decision.matchedBottleId,
        )
      ) {
        throw new Error(
          `Classifier returned unknown suggested bottle id (${classification.decision.matchedBottleId}).`,
        );
      }
      const decision = toStorePriceMatchDecision({
        price,
        decision: classification.decision,
      });
      const automationAssessment = assessBottleResolution({
        decision: classification.decision,
        currentBottleId: price.bottleId,
        candidates,
        sourceBottleIdentity: price.sourceBottleIdentity
          ? BottleExtractedDetailsSchema.parse(price.sourceBottleIdentity)
          : null,
        readListingImage:
          classification.artifacts.extractedIdentitySource === "image",
      });
      const { proposal, attempt } = await db.transaction(async (tx) => {
        const proposal = await upsertStorePriceMatchProposal({
          price,
          extractedLabel,
          candidates,
          decision,
          automationAssessment,
          searchEvidence,
          expectedProcessingToken: processingToken,
          tx,
        });
        const attempt = await recordStorePriceMatchAttempt({
          proposal,
          automationAssessment,
          tx,
        });
        await persistStorePriceBottleCheck({
          attemptId: attempt.id,
          classificationInput,
          classification,
          database: tx,
          model: proposal.model,
          modelMetadata: classificationModelMetadata,
          priceId: price.id,
        });
        return { proposal, attempt };
      });

      const shouldAutoCreate = shouldAutoCreateStorePriceMatchProposal({
        decision,
        automationAssessment,
      });

      const shouldAutoApprove =
        decision.action === "match" && automationAssessment.automationEligible;
      if (!shouldAutoApprove && !shouldAutoCreate) {
        return proposal;
      }

      let automationUser: User | null = null;

      try {
        automationUser = await getAutomationModeratorUser();

        if (
          processingToken &&
          !(await canContinueStorePriceMatchProcessing(
            proposal.id,
            processingToken,
          ))
        ) {
          return await reloadStorePriceMatchProposal(proposal.id);
        }

        if (shouldAutoApprove) {
          if (!proposal.suggestedBottleId) {
            throw new Error(
              `Unable to auto-approve a price match proposal without a suggested Bottle (${proposal.id}).`,
            );
          }

          await applyApprovedStorePriceMatch({
            proposalId: proposal.id,
            bottleId: proposal.suggestedBottleId,
            reviewedById: automationUser.id,
            actor: await getPeatedSystemActor(),
            allowSystemActor: true,
            expectedProcessingToken: processingToken,
          });

          return await reloadStorePriceMatchProposal(proposal.id);
        }

        const bottleInput = buildStorePriceMatchBottleInput(decision);

        await createBottleFromStorePriceMatchProposal(
          {
            proposalId: proposal.id,
            bottleInput,
            user: automationUser,
            creationSource: "price_match_automation",
            actor: await getPeatedSystemActor(),
            expectedProcessingToken: processingToken,
          },
          finalizeBottle,
        );

        return await reloadStorePriceMatchProposal(proposal.id);
      } catch (err) {
        logError(err, {
          price: {
            id: price.id,
            name: price.name,
          },
          proposal: {
            id: proposal.id,
          },
        });

        const error =
          err instanceof Error
            ? err.message
            : shouldAutoApprove
              ? "Unknown auto-approval error"
              : "Unknown auto-create error";
        const erroredProposal = await db.transaction(async (tx) => {
          const updatedProposal = await upsertStorePriceMatchProposal({
            price,
            extractedLabel,
            candidates,
            decision,
            automationAssessment,
            searchEvidence,
            error,
            statusOverride: "errored",
            expectedProcessingToken: processingToken,
            tx,
          });
          await markOwnedStorePriceMatchAttemptFinalInTransaction(tx, {
            attemptId: attempt.id,
            proposalId: updatedProposal.id,
            expectedProcessingToken: processingToken,
            finalStatus: "errored",
            reviewedById: automationUser?.id ?? null,
            error,
          });
          return updatedProposal;
        });
        return erroredProposal;
      }
    } catch (err) {
      // Nothing was saved yet, so the job retries once the AI service is
      // back. Saving an errored proposal here would block automatic retries.
      if (err instanceof Error && isModelServiceUnavailable(err)) throw err;

      logError(err, {
        price: {
          id: price.id,
          name: price.name,
        },
      });

      const proposal = await upsertStorePriceMatchProposal({
        price,
        extractedLabel:
          err instanceof BottleClassificationError
            ? parseClassifierExtractedLabel(err.artifacts.extractedIdentity)
            : extractedLabel,
        candidates:
          err instanceof BottleClassificationError
            ? parseClassifierCandidates(err.artifacts.candidates)
            : candidates,
        searchEvidence:
          err instanceof BottleClassificationError
            ? err.artifacts.searchEvidence
            : searchEvidence,
        error: err instanceof Error ? err.message : "Unknown classifier error",
        // A retry failure is operational, not a new semantic no-match decision.
        // Preserve the last completed decision while exposing the failed attempt.
        preserveExistingDecision: true,
        expectedProcessingToken: processingToken,
      });
      await recordStorePriceMatchAttempt({ proposal });
      return proposal;
    } finally {
      if (processingToken && existingProposal) {
        await releaseStorePriceMatchProposalProcessingLease({
          proposalId: existingProposal.id,
          processingToken,
        });
      }
    }
  };
}

export const resolveStorePriceMatchProposal = createStorePriceMatchResolver();

export async function getStorePriceMatchProposalForReviewInTransaction(
  tx: AnyDatabase,
  {
    proposalId,
    expectedProposalTypes,
    allowedStatuses = REVIEWABLE_STORE_PRICE_MATCH_PROPOSAL_STATUSES,
    expectedProcessingToken,
  }: {
    proposalId: number;
    expectedProposalTypes?: readonly StorePriceMatchProposal["proposalType"][];
    allowedStatuses?: readonly StorePriceMatchProposal["status"][];
    expectedProcessingToken?: string;
  },
): Promise<StorePriceMatchProposalForReview> {
  const preflight = await getStorePriceMatchProposalPreflight(tx, proposalId);
  // Price matching owns lock order: reusable references precede their consumers.
  if (preflight.referenceScope === "global_alias") {
    await tx
      .select({ id: bottleReferences.id })
      .from(bottleReferences)
      .where(
        eq(
          sql`LOWER(${bottleReferences.name})`,
          normalizeBottleReferenceKey(preflight.price.name).toLowerCase(),
        ),
      )
      .for("update");
  }
  const [row] = await tx
    .select({
      proposal: storePriceMatchProposals,
      price: storePrices,
    })
    .from(storePriceMatchProposals)
    .innerJoin(
      storePrices,
      eq(storePrices.id, storePriceMatchProposals.priceId),
    )
    .where(eq(storePriceMatchProposals.id, proposalId))
    .limit(1)
    .for("update");

  if (!row) {
    throw new UnknownStorePriceMatchProposalError(proposalId);
  }
  if (
    row.price.name !== preflight.price.name ||
    row.proposal.referenceScope !== preflight.referenceScope
  ) {
    throw new StorePriceMatchProposalIdentityChangedError(proposalId);
  }
  // A row written by the previous release during a deploy may use old names.
  row.proposal.status = toCurrentProposalStatus(row.proposal.status);
  row.proposal.proposalType = toCurrentProposalType(row.proposal.proposalType);

  if (!allowedStatuses.includes(row.proposal.status)) {
    throw new StorePriceMatchProposalNotReviewableError(
      proposalId,
      row.proposal.status,
    );
  }

  const hasActiveProcessingLease =
    hasActiveStorePriceMatchProposalProcessingLease(row.proposal);

  if (expectedProcessingToken) {
    if (
      !hasActiveProcessingLease ||
      row.proposal.processingToken !== expectedProcessingToken
    ) {
      throw new StorePriceMatchProposalAlreadyProcessingError(proposalId);
    }
  } else if (hasActiveProcessingLease) {
    throw new StorePriceMatchProposalAlreadyProcessingError(proposalId);
  }

  if (
    expectedProposalTypes &&
    !expectedProposalTypes.includes(row.proposal.proposalType)
  ) {
    throw new InvalidStorePriceMatchProposalTypeError(
      proposalId,
      row.proposal.proposalType,
      expectedProposalTypes,
    );
  }

  return {
    ...row.proposal,
    price: row.price,
  };
}

/**
 * Performs an intentionally unlocked catalog-identity preflight so callers can
 * acquire catalog identity locks ahead of proposal and mutation locks.
 */
async function getStorePriceMatchProposalPreflight(
  tx: AnyDatabase,
  proposalId: number,
): Promise<StorePriceMatchProposalForReview> {
  const [row] = await tx
    .select({
      proposal: storePriceMatchProposals,
      price: storePrices,
    })
    .from(storePriceMatchProposals)
    .innerJoin(
      storePrices,
      eq(storePrices.id, storePriceMatchProposals.priceId),
    )
    .where(eq(storePriceMatchProposals.id, proposalId))
    .limit(1);

  if (!row) {
    throw new UnknownStorePriceMatchProposalError(proposalId);
  }

  return { ...row.proposal, price: row.price };
}

async function markApprovedStorePriceMatchProposalInTransaction(
  tx: AnyDatabase,
  {
    proposalId,
    bottleId,
    reviewedById,
  }: {
    proposalId: number;
    bottleId: number;
    reviewedById: number;
  },
) {
  await tx
    .update(storePriceMatchProposals)
    .set({
      status: "approved",
      currentBottleId: bottleId,
      suggestedBottleId: bottleId,
      processingToken: null,
      processingQueuedAt: null,
      processingExpiresAt: null,
      reviewedById,
      reviewedAt: sql`NOW()`,
      updatedAt: sql`NOW()`,
      error: null,
    })
    .where(eq(storePriceMatchProposals.id, proposalId));

  await markLatestStorePriceMatchAttemptFinalInTransaction(tx, {
    proposalId,
    finalStatus: "approved",
    reviewedById,
    assignment: { bottleId },
  });
}

async function persistApprovedStorePriceMatchInTransaction(
  tx: AnyTransaction,
  {
    proposal,
    reviewedById,
    decisionLog,
    bottleId,
  }: {
    proposal: StorePriceMatchProposalForReview;
    reviewedById: number;
    decisionLog: {
      actor: IncomingBottleDecisionActor;
      decision: IncomingBottleDecisionType;
      createdBottle?: boolean;
      metadata?: IncomingBottleDecisionMetadata;
    };
    bottleId: number;
  },
) {
  await tx
    .update(storePrices)
    .set({
      bottleId,
      matchedReferenceId: null,
      updatedAt: sql`NOW()`,
    })
    .where(eq(storePrices.id, proposal.price.id));

  await markApprovedStorePriceMatchProposalInTransaction(tx, {
    proposalId: proposal.id,
    bottleId,
    reviewedById,
  });

  // One approved store price should always leave behind one source record keyed
  // by the store_price id so moderators can recover the original evidence later.
  await upsertStorePriceObservationInTransaction(tx, {
    proposal,
    bottleId,
    createdById: reviewedById,
  });

  // The decision writer deduplicates retries, not later assignments. Offer a completed
  // moderation decision so legacy or preassigned prices still gain history.
  const metadata: IncomingBottleDecisionMetadata = {
    ...decisionLog.metadata,
    proposalType: proposal.proposalType,
    referenceScope: proposal.referenceScope ?? "none",
    previousBottleId: proposal.price.bottleId,
  };
  if (proposal.price.matchedReferenceId !== null)
    metadata.previousReferenceId = proposal.price.matchedReferenceId;
  if (decisionLog.actor.type === "system") {
    metadata.initiatedByUserId = reviewedById;
  }
  await recordIncomingBottleDecisionInTransaction(tx, {
    sourceKind: "store_price",
    sourceId: proposal.price.id,
    proposalId: proposal.id,
    externalSiteId: proposal.price.externalSiteId,
    name: proposal.price.name,
    url: proposal.price.url,
    decision: decisionLog.decision,
    actor: decisionLog.actor,
    bottleId,
    createdBottle: decisionLog.createdBottle ?? false,
    confidence: proposal.confidence,
    model: proposal.model,
    rationale: proposal.rationale,
    metadata,
  });
}

/**
 * Applies one approved proposal to one independently complete Bottle.
 */
export async function applyApprovedStorePriceMatchProposalInTransaction(
  tx: AnyTransaction,
  {
    proposal,
    reviewedById,
    allowSystemActor = false,
    decisionLog,
    bottleId,
  }: {
    proposal: StorePriceMatchProposalForReview;
    reviewedById: number;
    allowSystemActor?: boolean;
    decisionLog: {
      actor: IncomingBottleDecisionActor;
      decision: IncomingBottleDecisionType;
      createdBottle?: boolean;
      metadata?: IncomingBottleDecisionMetadata;
    };
    bottleId: number;
  },
) {
  const actor = await getPriceMatchWriteActorForDatabase(
    tx,
    decisionLog.actor,
    {
      userId: reviewedById,
      allowSystemActor,
    },
  );

  // A BottleReference affects other listings and external reviews. Create it only when the
  // proposal explicitly allows that reuse and the moderator accepted the
  // suggested Bottle. The exact StorePrice assignment below is independent.
  const shouldAssignReference =
    proposal.referenceScope === "global_alias" &&
    (proposal.proposalType === "create_bottle" ||
      proposal.suggestedBottleId === bottleId);
  const referenceResult = shouldAssignReference
    ? await assignBottleReferenceInTransaction(tx, {
        bottleId,
        externalSiteId: proposal.price.externalSiteId,
        name: normalizeBottleReferenceKey(proposal.price.name),
        backfillNames: [proposal.price.name],
        volume: proposal.price.volume,
        ignored: false,
        assignmentSource: "source_approved",
        assignedByActorId: actor.id,
      })
    : null;

  await persistApprovedStorePriceMatchInTransaction(tx, {
    proposal,
    reviewedById,
    bottleId,
    decisionLog: {
      ...decisionLog,
      actor,
    },
  });

  return {
    referenceResult,
    bottleImageCandidate:
      referenceResult === null && proposal.price.imageUrl
        ? {
            bottleId,
            imageUrl: proposal.price.imageUrl,
            sourceUrl: proposal.price.url,
            createdByActorId: actor.id,
          }
        : null,
  };
}

async function finalizeStorePriceApproval(
  approval: Awaited<
    ReturnType<typeof applyApprovedStorePriceMatchProposalInTransaction>
  >,
  bottleId: number,
) {
  if (approval.referenceResult) {
    await finalizeBottleReferenceAssignment(approval.referenceResult, {
      bottle: { id: bottleId },
    });
    return;
  }
  await fillMissingBottleImage(approval.bottleImageCandidate, {
    bottle: { id: bottleId },
  });
}

export async function applyApprovedStorePriceMatchInTransaction(
  tx: AnyTransaction,
  {
    proposalId,
    bottleId,
    reviewedById,
    actor,
    allowSystemActor = false,
    expectedProcessingToken,
  }: {
    proposalId: number;
    bottleId: number;
    reviewedById: number;
    actor: IncomingBottleDecisionActor;
    allowSystemActor?: boolean;
    expectedProcessingToken?: string;
  },
) {
  await resolveActiveBottleIds(tx, [bottleId], { lock: "update" });

  const proposal = await getStorePriceMatchProposalForReviewInTransaction(tx, {
    proposalId,
    expectedProcessingToken,
  });

  return {
    approval: await applyApprovedStorePriceMatchProposalInTransaction(tx, {
      proposal,
      reviewedById,
      allowSystemActor,
      bottleId,
      decisionLog: {
        actor,
        decision: "match",
      },
    }),
    bottleId,
  };
}

export async function applyApprovedStorePriceMatch({
  proposalId,
  bottleId,
  reviewedById,
  actor,
  allowSystemActor = false,
  expectedProcessingToken,
}: {
  proposalId: number;
  bottleId: number;
  reviewedById: number;
  actor: IncomingBottleDecisionActor;
  allowSystemActor?: boolean;
  expectedProcessingToken?: string;
}) {
  const { approval } = await db.transaction(async (tx) =>
    applyApprovedStorePriceMatchInTransaction(tx, {
      proposalId,
      bottleId,
      reviewedById,
      actor,
      allowSystemActor,
      expectedProcessingToken,
    }),
  );

  await finalizeStorePriceApproval(approval, bottleId);
}

/**
 * Commits the canonical Bottle update and proposal approval atomically, then
 * runs both retained finalizers only after that transaction commits.
 */
export async function ignoreStorePriceMatchProposal({
  proposalId,
  reviewedById,
  actor,
}: {
  proposalId: number;
  reviewedById: number;
  actor: IncomingBottleDecisionActor;
}) {
  await db.transaction(async (tx) => {
    await getStorePriceMatchProposalForReviewInTransaction(tx, {
      proposalId,
    });

    await getPriceMatchWriteActorForDatabase(tx, actor, {
      userId: reviewedById,
    });

    await tx
      .update(storePriceMatchProposals)
      .set({
        status: "ignored",
        reviewedById,
        reviewedAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
        processingToken: null,
        processingQueuedAt: null,
        processingExpiresAt: null,
        error: null,
      })
      .where(eq(storePriceMatchProposals.id, proposalId));

    await markLatestStorePriceMatchAttemptFinalInTransaction(tx, {
      proposalId,
      finalStatus: "ignored",
      reviewedById,
    });
  });
}

export async function ignoreInconclusiveStorePriceMatchProposals({
  reviewedById,
  actor,
}: {
  reviewedById: number;
  actor: IncomingBottleDecisionActor;
}): Promise<number> {
  return await db.transaction(async (tx) => {
    await getPriceMatchWriteActorForDatabase(tx, actor, {
      userId: reviewedById,
    });

    // Bulk moderation owns only pending, unleased no-match proposals that are
    // visible in the listing inbox. Other proposal outcomes keep their normal
    // per-item review boundary.
    const ignored = await tx
      .update(storePriceMatchProposals)
      .set({
        status: "ignored",
        reviewedById,
        reviewedAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
        processingToken: null,
        processingQueuedAt: null,
        processingExpiresAt: null,
        error: null,
      })
      .where(
        and(
          eq(storePriceMatchProposals.status, "pending_review"),
          eq(storePriceMatchProposals.proposalType, "no_match"),
          sql`(${storePriceMatchProposals.processingExpiresAt} IS NULL OR ${storePriceMatchProposals.processingExpiresAt} <= NOW())`,
          sql`EXISTS (
            SELECT 1
            FROM ${storePrices}
            WHERE ${storePrices.id} = ${storePriceMatchProposals.priceId}
              AND ${storePrices.hidden} = false
              AND ${currentStorePriceCondition()}
          )`,
        ),
      )
      .returning({ id: storePriceMatchProposals.id });

    for (let offset = 0; offset < ignored.length; offset += 10_000) {
      const proposalIds = ignored
        .slice(offset, offset + 10_000)
        .map(({ id }) => id);
      await tx.execute(sql`
        UPDATE ${storePriceMatchAttempts}
        SET
          final_status = 'ignored',
          reviewed_by_id = ${reviewedById},
          reviewed_at = NOW(),
          updated_at = NOW()
        WHERE id IN (
          SELECT MAX(id)
          FROM ${storePriceMatchAttempts}
          WHERE ${inArray(storePriceMatchAttempts.proposalId, proposalIds)}
          GROUP BY ${storePriceMatchAttempts.proposalId}
        )
      `);
    }

    return ignored.length;
  });
}
