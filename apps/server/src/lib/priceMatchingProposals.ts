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
import type { WebEvidenceJudgment } from "@peated/bottle-classifier/priceMatchingEvidence";
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
  bottleObservations,
  bottles,
  storePriceMatchAttempts,
  storePriceMatchProposals,
  storePrices,
  type StorePrice,
  type StorePriceMatchProposal,
  type User,
} from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import {
  assignBottleAliasInTransaction,
  finalizeBottleAliasAssignment,
} from "@peated/server/lib/bottleAliases";
import { createBottleCheck } from "@peated/server/lib/bottleChecks";
import type { BottleCreateInput } from "@peated/server/lib/bottleSchemas";
import {
  buildBottleInputFromProposedBottle,
  buildClassifierBottleInput,
} from "@peated/server/lib/classifierDecisionCreateInputs";
import {
  createOrReuseBottleInTransaction,
  finalizeCreatedBottle,
} from "@peated/server/lib/createBottle";
import {
  recordIncomingBottleDecisionInTransaction,
  shouldRecordIncomingBottleDecision,
  type IncomingBottleDecisionActor,
  type IncomingBottleDecisionType,
} from "@peated/server/lib/incomingBottleDecisionLog";
import { logError, logInfo } from "@peated/server/lib/log";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import {
  getStorePriceMatchAutomationAssessment,
  shouldVerifyStorePriceMatch,
  type StorePriceMatchAutomationAssessment,
} from "@peated/server/lib/priceMatchingAutomation";
import {
  hasActiveStorePriceMatchProposalProcessingLease,
  refreshStorePriceMatchProposalProcessingLease,
  releaseStorePriceMatchProposalProcessingLease,
} from "@peated/server/lib/priceMatchingProcessingLease";
import { REVIEWABLE_STORE_PRICE_MATCH_PROPOSAL_STATUSES } from "@peated/server/lib/priceMatchingStatus";
import { resolveActiveBottleIds } from "@peated/server/lib/resolveActiveBottleIds";
import { getAutomationModeratorUser } from "@peated/server/lib/systemUser";
import {
  finalizeBottleUpdate,
  updateBottleInTransaction,
  type BottlePatch,
} from "@peated/server/lib/updateBottle";
import type { PriceMatchSearchEvidenceSchema } from "@peated/server/schemas";
import {
  ProposedBottleSchema,
  StorePriceBottleRepairDraftSchema,
  StorePriceMatchDecisionSchema,
} from "@peated/server/schemas";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, eq, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import type { z } from "zod";

type ExtractedBottleDetails = BottleExtractedDetails;
type PriceMatchCandidate = BottleCandidate;
type SearchEvidence = z.infer<typeof PriceMatchSearchEvidenceSchema>;
type ProposedBottle = z.infer<typeof ProposedBottleSchema>;
type StorePriceBottleRepairDraft = z.infer<
  typeof StorePriceBottleRepairDraftSchema
>;
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

function normalizeClassifierDecisionForPriceMatching(
  decision: BottleClassificationDecision,
  candidates: PriceMatchCandidate[],
): BottleClassificationDecision {
  if (
    decision.action === "match" &&
    !candidates.some(
      (candidate) => candidate.bottleId === decision.matchedBottleId,
    )
  ) {
    throw new Error(
      `Classifier returned unknown suggested bottle id (${decision.matchedBottleId}).`,
    );
  }

  return decision;
}

/**
 * Maps sparse persisted repair drafts to the canonical flat Bottle patch.
 * Unknown null fields or empty distiller lists are omitted rather than cleared.
 */
function buildBottleRepairInput(
  proposedBottle: StorePriceBottleRepairDraft,
): BottlePatch {
  const proposedInput = buildBottleInputFromProposedBottle(proposedBottle);
  const patch: BottlePatch = {
    name: proposedInput.name,
    brand: proposedInput.brand,
  };

  if (proposedBottle.series !== null) patch.series = proposedInput.series!;
  if (proposedBottle.category !== null) {
    patch.category = proposedBottle.category;
  }
  if (proposedBottle.statedAge !== null) {
    patch.statedAge = proposedBottle.statedAge;
  }
  if (proposedBottle.distillers.length > 0) {
    patch.distillers = proposedInput.distillers;
  }
  if (proposedBottle.bottler !== null) {
    patch.bottler = proposedInput.bottler!;
  }

  if (proposedBottle.edition !== null) patch.edition = proposedBottle.edition;
  if (proposedBottle.abv !== null) patch.abv = proposedBottle.abv;
  if (proposedBottle.singleCask !== null) {
    patch.singleCask = proposedBottle.singleCask;
  }
  if (proposedBottle.caskStrength !== null) {
    patch.caskStrength = proposedBottle.caskStrength;
  }
  if (proposedBottle.vintageYear !== null) {
    patch.vintageYear = proposedBottle.vintageYear;
  }
  if (proposedBottle.releaseYear !== null) {
    patch.releaseYear = proposedBottle.releaseYear;
  }
  if (proposedBottle.caskType !== null)
    patch.caskType = proposedBottle.caskType;
  if (proposedBottle.caskSize !== null)
    patch.caskSize = proposedBottle.caskSize;
  if (proposedBottle.caskFill !== null)
    patch.caskFill = proposedBottle.caskFill;

  return patch;
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
    const action =
      price.bottleId !== null && price.bottleId !== decision.matchedBottleId
        ? "correction"
        : "match_existing";

    return {
      action,
      confidence: null,
      rationale: decision.rationale,
      candidateBottleIds: decision.candidateBottleIds,
      identityScope: decision.identityScope,
      aliasScope: decision.aliasScope ?? "none",
      suggestedBottleId: decision.matchedBottleId,
      proposedBottle: null,
    };
  }

  if (decision.action === "create_bottle") {
    return {
      action: "create_new",
      confidence: null,
      rationale: decision.rationale,
      candidateBottleIds: decision.candidateBottleIds,
      identityScope: decision.identityScope,
      aliasScope: decision.aliasScope ?? "none",
      suggestedBottleId: null,
      proposedBottle: parseClassifierProposedBottle(decision.proposedBottle),
    };
  }

  return {
    action: "no_match",
    confidence: null,
    rationale: decision.rationale,
    candidateBottleIds: decision.candidateBottleIds,
    identityScope: decision.identityScope,
    aliasScope: decision.aliasScope ?? "none",
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
    readonly expectedProposalType: StorePriceMatchProposal["proposalType"],
  ) {
    super(
      `Price match proposal has invalid type (${proposalId}, expected ${expectedProposalType}, got ${proposalType}).`,
    );
    this.name = "InvalidStorePriceMatchProposalTypeError";
  }
}

export class StorePriceBottleRepairBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorePriceBottleRepairBadRequestError";
  }
}

function getProposalType(
  price: StorePrice,
  decision: StorePriceMatchDecision,
): StorePriceMatchProposal["proposalType"] {
  if (decision.action === "create_new") {
    return "create_new";
  }

  if (price.bottleId) {
    if (
      decision.action === "match_existing" &&
      decision.suggestedBottleId === price.bottleId
    ) {
      return "match_existing";
    }
    return "correction";
  }
  return decision.action;
}

// Structured evidence the code-derived automation tier reads. Carried
// alongside the translated price-match decision because the derived tier no
// longer reads the numeric `confidence` score.
type StorePriceMatchDecisionEvidence = {
  hasUnresolvedRisks: boolean;
  webEvidence: WebEvidenceJudgment;
};

function getProposalStatus(
  price: StorePrice,
  decision: StorePriceMatchDecision,
  automationAssessment: StorePriceMatchAutomationAssessment | null,
  decisionEvidence: StorePriceMatchDecisionEvidence | null,
): StorePriceMatchProposal["status"] {
  if (
    automationAssessment &&
    shouldVerifyStorePriceMatch({
      action: decision.action,
      currentBottleId: price.bottleId,
      identityScope: decision.identityScope,
      suggestedBottleId: decision.suggestedBottleId,
      hasUnresolvedRisks: decisionEvidence?.hasUnresolvedRisks ?? false,
      webEvidence: decisionEvidence?.webEvidence ?? null,
      automationBlockers: automationAssessment.automationBlockers,
      plainAgeBottleAutoVerifyEligible:
        automationAssessment.plainAgeBottleAutoVerifyEligible,
    })
  ) {
    return "verified";
  }
  return "pending_review";
}

function shouldTrackStorePriceQueueEntry(
  status: StorePriceMatchProposal["status"],
) {
  return status === "pending_review" || status === "errored";
}

function getInitialAttemptFinalStatus(
  status: StorePriceMatchProposal["status"],
): StorePriceMatchProposal["status"] | null {
  if (status === "pending_review" || status === "verified") {
    return null;
  }
  return status;
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
      automationScore: automationAssessment?.automationScore ?? null,
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
) {
  if (!shouldTrackStorePriceQueueEntry(status)) {
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
    decision.action === "create_new" &&
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
  if (decision.action !== "create_new" || decision.proposedBottle === null) {
    throw new Error(
      "Price match decision does not contain one Bottle creation input.",
    );
  }

  return buildClassifierBottleInput(decision.proposedBottle);
}

function getStorePriceBottleRepairDraft(
  proposal: StorePriceMatchProposalForReview,
): StorePriceBottleRepairDraft {
  if (
    proposal.currentBottleId === null ||
    proposal.suggestedBottleId === null ||
    proposal.currentBottleId !== proposal.suggestedBottleId
  ) {
    throw new StorePriceBottleRepairBadRequestError(
      "Price match proposal is not an existing-bottle repair.",
    );
  }

  const parsedBottle = StorePriceBottleRepairDraftSchema.safeParse(
    proposal.proposedBottle,
  );
  if (!parsedBottle.success) {
    throw new StorePriceBottleRepairBadRequestError(
      "Price match proposal does not contain a valid bottle repair draft.",
    );
  }

  return parsedBottle.data;
}

function buildStorePriceObservationFacts(
  proposal: Pick<
    StorePriceMatchProposalForReview,
    "proposalType" | "proposedBottle"
  >,
) {
  return {
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
  // Preserve the exact store listing as evidence even when the canonical alias
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
  decisionEvidence,
  automationAssessment,
  searchEvidence,
  error,
  statusOverride,
  expectedProcessingToken,
  tx = db,
}: {
  price: StorePrice;
  extractedLabel: ExtractedBottleDetails | null;
  candidates: PriceMatchCandidate[];
  decision?: StorePriceMatchDecision | null;
  decisionEvidence?: StorePriceMatchDecisionEvidence | null;
  automationAssessment?: StorePriceMatchAutomationAssessment | null;
  searchEvidence?: SearchEvidence[];
  error?: string | null;
  statusOverride?: StorePriceMatchProposal["status"] | null;
  expectedProcessingToken?: string;
  tx?: AnyDatabase;
}) {
  const parsedDecision = decision
    ? StorePriceMatchDecisionSchema.parse(decision)
    : null;
  const proposalType = parsedDecision
    ? getProposalType(price, parsedDecision)
    : "no_match";
  const status =
    statusOverride ??
    (parsedDecision
      ? getProposalStatus(
          price,
          parsedDecision,
          automationAssessment ?? null,
          decisionEvidence ?? null,
        )
      : "errored");
  const enteredQueueAt = shouldTrackStorePriceQueueEntry(status)
    ? sql`NOW()`
    : null;
  const proposalRuntimeValues = {
    status,
    proposalType,
    confidence: parsedDecision?.confidence ?? null,
    currentBottleId: price.bottleId,
    suggestedBottleId: parsedDecision?.suggestedBottleId ?? null,
    aliasScope: parsedDecision?.aliasScope ?? null,
    candidateBottles: candidates,
    extractedLabel,
    proposedBottle: parsedDecision?.proposedBottle ?? null,
    searchEvidence: searchEvidence || [],
    automationAssessment: automationAssessment ?? null,
    rationale: parsedDecision?.rationale ?? null,
    model: config.BOTTLE_CLASSIFIER_MODEL,
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
  const updateValues = {
    ...proposalRuntimeValues,
    enteredQueueAt: getStorePriceQueueEntryUpdateValue(status),
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
    expectedProposalType: "create_new",
    allowedStatuses: ["pending_review"],
    expectedProcessingToken,
  });
  if (
    proposal.priceId !== preflight.priceId ||
    proposal.price.bottleId !== preflight.price.bottleId ||
    !isDeepStrictEqual(proposal.proposedBottle, preflight.proposedBottle)
  ) {
    throw new StorePriceMatchProposalIdentityChangedError(proposalId);
  }

  const aliasResult = await applyApprovedStorePriceMatchProposalInTransaction(
    tx,
    {
      proposal,
      reviewedById: user.id,
      allowSystemActor: creationSource === "price_match_automation",
      decisionLog: {
        actor: writeActor,
        decision: createResult ? "create_bottle" : "match_existing",
        createdBottle: !!createResult,
        metadata: {
          creationSource,
          reusedExistingBottle: !createResult,
        },
      },
      bottleId: resolvedBottle.id,
    },
  );

  return {
    createResult,
    aliasResult,
    bottle: resolvedBottle,
  };
}

export async function createBottleFromStorePriceMatchProposal({
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
}) {
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
    await finalizeCreatedBottle(result.createResult, {
      creationSource,
    });
  }
  await finalizeBottleAliasAssignment(result.aliasResult, {
    bottle: { id: result.bottle.id },
  });

  return {
    bottle: result.bottle,
  };
}

/**
 * Owns full store-price classification persistence: the proposal, attempt, and
 * linked Bottle check commit together before any automated catalog mutation.
 */
export async function resolveStorePriceMatchProposal(
  priceId: number,
  {
    candidateExpansion = "open",
    force = false,
    processingToken,
    reuseExistingExtraction = false,
  }: {
    candidateExpansion?: CandidateExpansionMode;
    force?: boolean;
    processingToken?: string;
    reuseExistingExtraction?: boolean;
  } = {},
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

    const refreshedLease = await refreshStorePriceMatchProposalProcessingLease({
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
    } else if (reuseExistingExtraction) {
      classificationInput.extractedIdentity =
        parseStoredExtractedLabel(existingProposal);
    }

    const classificationRun =
      await runScrapedBottleReference(classificationInput);
    const classification = classificationRun.result;
    classificationModelMetadata = classificationRun.modelMetadata;

    extractedLabel = parseClassifierExtractedLabel(
      classification.artifacts.extractedIdentity,
    );
    candidates = parseClassifierCandidates(classification.artifacts.candidates);
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

    const classifierDecision = normalizeClassifierDecisionForPriceMatching(
      classification.decision,
      candidates,
    );
    const decision = toStorePriceMatchDecision({
      price,
      decision: classifierDecision,
    });
    const automationAssessment = getStorePriceMatchAutomationAssessment({
      action: decision.action,
      modelConfidence: decision.confidence,
      price,
      suggestedBottleId: decision.suggestedBottleId,
      candidateBottles: candidates,
      extractedLabel,
      proposedBottle: decision.proposedBottle,
      searchEvidence,
      sourceBottleIdentity: price.sourceBottleIdentity
        ? BottleExtractedDetailsSchema.parse(price.sourceBottleIdentity)
        : null,
      hasUnresolvedRisks:
        (classification.decision.confidenceBasis?.unresolvedRisks.length ?? 0) >
        0,
      webEvidenceJudgment:
        classification.decision.confidenceBasis?.webEvidence ?? null,
    });
    const { proposal, attempt } = await db.transaction(async (tx) => {
      const proposal = await upsertStorePriceMatchProposal({
        price,
        extractedLabel,
        candidates,
        decision,
        decisionEvidence: {
          hasUnresolvedRisks:
            (classification.decision.confidenceBasis?.unresolvedRisks.length ??
              0) > 0,
          webEvidence:
            classification.decision.confidenceBasis?.webEvidence ?? null,
        },
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

    if (proposal.status !== "verified" && !shouldAutoCreate) {
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

      if (proposal.status === "verified") {
        if (!proposal.suggestedBottleId) {
          throw new Error(
            `Unable to auto-approve verified price match proposal without a suggested Bottle (${proposal.id}).`,
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

      await createBottleFromStorePriceMatchProposal({
        proposalId: proposal.id,
        bottleInput,
        user: automationUser,
        creationSource: "price_match_automation",
        actor: await getPeatedSystemActor(),
        expectedProcessingToken: processingToken,
      });

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
          : proposal.status === "verified"
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
}

export async function getStorePriceMatchProposalForReviewInTransaction(
  tx: AnyDatabase,
  {
    proposalId,
    expectedProposalType,
    allowedStatuses = REVIEWABLE_STORE_PRICE_MATCH_PROPOSAL_STATUSES,
    expectedProcessingToken,
  }: {
    proposalId: number;
    expectedProposalType?: StorePriceMatchProposal["proposalType"];
    allowedStatuses?: readonly StorePriceMatchProposal["status"][];
    expectedProcessingToken?: string;
  },
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
    .limit(1)
    .for("update");

  if (!row) {
    throw new UnknownStorePriceMatchProposalError(proposalId);
  }

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
    expectedProposalType &&
    row.proposal.proposalType !== expectedProposalType
  ) {
    throw new InvalidStorePriceMatchProposalTypeError(
      proposalId,
      row.proposal.proposalType,
      expectedProposalType,
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
      metadata?: Record<string, unknown>;
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

  const aliasKey = normalizeBottleAliasKey(proposal.price.name);
  // Alias-safety gate: a newly assigned listing title only becomes a reusable
  // global alias when the decision asserted `aliasScope = global_alias`. For
  // "none"/null/missing scope the source listing is still assigned (backfilled)
  // and retained for provenance, but the new alias is marked ignored so a
  // generic retailer title cannot be reused for future listings. Aliases that
  // are already assigned to this target keep their existing ignored state.
  const reusableGlobalAlias = proposal.aliasScope === "global_alias";
  const aliasInput = {
    bottleId,
    externalSiteId: proposal.price.externalSiteId,
    name: aliasKey,
    backfillNames: [proposal.price.name],
    volume: proposal.price.volume,
    ignored: !reusableGlobalAlias,
    assignmentSource: "source_approved",
    assignedByActorId: actor.id,
  } satisfies Parameters<typeof assignBottleAliasInTransaction>[1];
  const aliasResult = await assignBottleAliasInTransaction(tx, aliasInput);

  await tx
    .update(storePrices)
    .set({
      bottleId,
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

  if (
    shouldRecordIncomingBottleDecision({
      previousBottleId: proposal.price.bottleId ?? proposal.currentBottleId,
      bottleId,
      decision: decisionLog.decision,
    })
  ) {
    await recordIncomingBottleDecisionInTransaction(tx, {
      sourceKind: "store_price",
      sourceId: proposal.price.id,
      proposalId: proposal.id,
      externalSiteId: proposal.price.externalSiteId,
      name: proposal.price.name,
      url: proposal.price.url,
      decision: decisionLog.decision,
      actor,
      bottleId,
      createdBottle: decisionLog.createdBottle ?? false,
      confidence: proposal.confidence,
      model: proposal.model,
      rationale: proposal.rationale,
      metadata: {
        proposalType: proposal.proposalType,
        ...(actor.type === "system" ? { initiatedByUserId: reviewedById } : {}),
        ...decisionLog.metadata,
      },
    });
  }

  return aliasResult;
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
    aliasResult: await applyApprovedStorePriceMatchProposalInTransaction(tx, {
      proposal,
      reviewedById,
      allowSystemActor,
      bottleId,
      decisionLog: {
        actor,
        decision: "match_existing",
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
  const { aliasResult } = await db.transaction(async (tx) =>
    applyApprovedStorePriceMatchInTransaction(tx, {
      proposalId,
      bottleId,
      reviewedById,
      actor,
      allowSystemActor,
      expectedProcessingToken,
    }),
  );

  await finalizeBottleAliasAssignment(aliasResult, {
    bottle: { id: bottleId },
  });
}

/**
 * Commits the canonical Bottle update and proposal approval atomically, then
 * runs both retained finalizers only after that transaction commits.
 */
export async function applyStorePriceBottleRepairFromProposal({
  proposalId,
  user,
  actor,
  expectedProcessingToken,
}: {
  proposalId: number;
  user: User;
  actor: IncomingBottleDecisionActor;
  expectedProcessingToken?: string;
}) {
  const { updateManifest, aliasResult } = await db.transaction(async (tx) => {
    const preflight = await getStorePriceMatchProposalPreflight(tx, proposalId);
    if (
      preflight.proposalType !== "correction" ||
      preflight.currentBottleId === null
    ) {
      throw new StorePriceBottleRepairBadRequestError(
        "Price match proposal is not an existing-bottle repair.",
      );
    }
    const repairBottleId = preflight.currentBottleId;
    if (preflight.suggestedBottleId !== repairBottleId) {
      throw new StorePriceBottleRepairBadRequestError(
        "Price match repair must select the current Bottle.",
      );
    }

    const proposedBottle = getStorePriceBottleRepairDraft(preflight);
    const writeActor = await getPriceMatchWriteActorForDatabase(tx, actor, {
      userId: user.id,
    });
    // The Bottle writer acquires and validates the active Bottle graph
    // before the proposal and its consumers are locked below.
    const updateManifest = await updateBottleInTransaction(tx, {
      bottleId: repairBottleId,
      input: buildBottleRepairInput(proposedBottle),
      actorId: writeActor.id,
      creationSource: "price_match_review",
    });

    const proposal = await getStorePriceMatchProposalForReviewInTransaction(
      tx,
      {
        proposalId,
        expectedProposalType: "correction",
        expectedProcessingToken,
      },
    );
    if (
      proposal.proposalType !== preflight.proposalType ||
      proposal.currentBottleId !== preflight.currentBottleId ||
      proposal.suggestedBottleId !== preflight.suggestedBottleId ||
      proposal.price.bottleId !== preflight.price.bottleId
    ) {
      throw new StorePriceMatchProposalIdentityChangedError(proposalId);
    }
    const approvedAliasResult =
      await applyApprovedStorePriceMatchProposalInTransaction(tx, {
        proposal,
        reviewedById: user.id,
        bottleId: updateManifest.bottle.id,
        decisionLog: {
          actor,
          decision: "match_existing",
        },
      });

    return {
      updateManifest,
      aliasResult: approvedAliasResult,
    };
  });

  await finalizeBottleAliasAssignment(aliasResult, {
    bottle: {
      id: updateManifest.bottle.id,
    },
  });
  await finalizeBottleUpdate(updateManifest);

  return updateManifest.bottle;
}

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
