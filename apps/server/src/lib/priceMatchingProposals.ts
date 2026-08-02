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
  runBottleReference,
  type BottleClassificationDecision,
} from "@peated/server/agents/bottleClassifier";
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
import {
  buildBottleInputFromProposedBottle,
  buildClassifierConcreteBottleInput,
} from "@peated/server/lib/classifierDecisionCreateInputs";
import type { ConcreteBottleCreateInput } from "@peated/server/lib/concreteBottleSchemas";
import {
  createOrReuseConcreteBottleInTransaction,
  finalizeCreatedBottle,
} from "@peated/server/lib/createConcreteBottle";
import {
  recordIncomingBottleDecisionInTransaction,
  shouldRecordIncomingBottleDecision,
  type IncomingBottleDecisionActor,
  type IncomingBottleDecisionType,
} from "@peated/server/lib/incomingBottleDecisionLog";
import { logError } from "@peated/server/lib/log";
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
import {
  CLOSED_STORE_PRICE_MATCH_PROPOSAL_STATUSES,
  REVIEWABLE_STORE_PRICE_MATCH_PROPOSAL_STATUSES,
} from "@peated/server/lib/priceMatchingStatus";
import {
  listMatchesExpectedValue,
  textsOverlap,
} from "@peated/server/lib/priceMatchingText";
import { resolveActiveBottleIds } from "@peated/server/lib/resolveActiveBottleIds";
import { getAutomationModeratorUser } from "@peated/server/lib/systemUser";
import {
  finalizeConcreteBottleUpdate,
  updateConcreteBottleInTransaction,
  type ConcreteBottleUpdateInput,
} from "@peated/server/lib/updateConcreteBottle";
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

  if (
    decision.action === "repair_bottle" &&
    !candidates.some(
      (candidate) => candidate.bottleId === decision.matchedBottleId,
    )
  ) {
    throw new Error(
      `Classifier returned unknown repair bottle id (${decision.matchedBottleId}).`,
    );
  }

  return decision;
}

/**
 * Maps sparse persisted repair drafts to canonical shared and exact patches.
 * Classifier repairs mark stated age as exact Bottle data; unmarked historical
 * drafts retain the legacy shared-age contract. Unknown null fields or empty
 * distiller lists are omitted rather than cleared.
 */
function buildConcreteBottleRepairInput(
  proposedBottle: StorePriceBottleRepairDraft,
): ConcreteBottleUpdateInput {
  const proposedInput = buildBottleInputFromProposedBottle(proposedBottle);
  const shared: NonNullable<ConcreteBottleUpdateInput["shared"]> = {
    name: proposedInput.name,
    brand: proposedInput.brand,
  };
  const exact: NonNullable<ConcreteBottleUpdateInput["exact"]> = {};

  if (proposedBottle.series !== null) shared.series = proposedInput.series!;
  if (proposedBottle.category !== null) {
    shared.category = proposedBottle.category;
  }
  if (proposedBottle.statedAge !== null) {
    if (proposedBottle.statedAgeScope === "exact") {
      exact.statedAge = proposedBottle.statedAge;
    } else {
      shared.statedAge = proposedBottle.statedAge;
    }
  }
  if (proposedBottle.distillers.length > 0) {
    shared.distillers = proposedInput.distillers;
  }
  if (proposedBottle.bottler !== null) {
    shared.bottler = proposedInput.bottler!;
  }

  if (proposedBottle.edition !== null) exact.edition = proposedBottle.edition;
  if (proposedBottle.abv !== null) exact.abv = proposedBottle.abv;
  if (proposedBottle.singleCask !== null) {
    exact.singleCask = proposedBottle.singleCask;
  }
  if (proposedBottle.caskStrength !== null) {
    exact.caskStrength = proposedBottle.caskStrength;
  }
  if (proposedBottle.vintageYear !== null) {
    exact.vintageYear = proposedBottle.vintageYear;
  }
  if (proposedBottle.releaseYear !== null) {
    exact.releaseYear = proposedBottle.releaseYear;
  }
  if (proposedBottle.caskType !== null)
    exact.caskType = proposedBottle.caskType;
  if (proposedBottle.caskSize !== null)
    exact.caskSize = proposedBottle.caskSize;
  if (proposedBottle.caskFill !== null)
    exact.caskFill = proposedBottle.caskFill;

  return {
    shared,
    ...(Object.keys(exact).length > 0 ? { exact } : {}),
  };
}

function buildClassifierBottleRepairDraft(
  proposedBottle: BottleClassificationDecision["proposedBottle"],
): StorePriceBottleRepairDraft | null {
  const normalized = parseClassifierProposedBottle(proposedBottle);
  return normalized
    ? {
        ...normalized,
        caskType: null,
        caskSize: null,
        caskFill: null,
        statedAgeScope: "exact",
      }
    : null;
}

function appendRationale(
  rationale: string | null | undefined,
  addition: string,
): string {
  const trimmedAddition = addition.trim();
  if (!rationale) {
    return trimmedAddition;
  }

  const trimmedRationale = rationale.trim();
  if (!trimmedRationale) {
    return trimmedAddition;
  }

  return `${trimmedRationale} ${trimmedAddition}`;
}

function candidateMatchesRepairDraftIdentity(
  candidate: PriceMatchCandidate,
  proposedBottle: ProposedBottle,
): boolean {
  const proposedFullName =
    `${proposedBottle.brand.name} ${proposedBottle.name}`.trim();
  const candidateNames = [candidate.alias, candidate.fullName].filter(
    (value): value is string => Boolean(value),
  );

  const brandMatches =
    textsOverlap(candidate.brand, proposedBottle.brand.name) ||
    candidateNames.some((value) =>
      textsOverlap(value, proposedBottle.brand.name),
    );
  const nameMatches = candidateNames.some(
    (value) =>
      textsOverlap(value, proposedBottle.name) ||
      textsOverlap(value, proposedFullName),
  );

  if (!brandMatches || !nameMatches) {
    return false;
  }

  if (!proposedBottle.series) {
    return true;
  }

  return (
    textsOverlap(candidate.series, proposedBottle.series.name) ||
    candidateNames.some((value) =>
      textsOverlap(value, proposedBottle.series?.name),
    )
  );
}

function candidateNeedsExistingBottleRepair(
  candidate: PriceMatchCandidate,
  proposedBottle: ProposedBottle,
): boolean {
  if (!textsOverlap(candidate.brand, proposedBottle.brand.name)) {
    return true;
  }

  if (
    proposedBottle.category !== null &&
    candidate.category !== proposedBottle.category
  ) {
    return true;
  }

  if (
    proposedBottle.series &&
    !textsOverlap(candidate.series, proposedBottle.series.name)
  ) {
    return true;
  }

  if (
    proposedBottle.bottler &&
    !textsOverlap(candidate.bottler, proposedBottle.bottler.name)
  ) {
    return true;
  }

  if (
    proposedBottle.distillers.length > 0 &&
    !listMatchesExpectedValue(
      candidate.distillery,
      proposedBottle.distillers.map((distiller) => distiller.name),
    )
  ) {
    return true;
  }

  if (
    proposedBottle.statedAge !== null &&
    candidate.statedAge !== proposedBottle.statedAge
  ) {
    return true;
  }

  if (
    proposedBottle.edition &&
    !textsOverlap(candidate.edition, proposedBottle.edition)
  ) {
    return true;
  }

  if (
    proposedBottle.caskStrength !== null &&
    candidate.caskStrength !== proposedBottle.caskStrength
  ) {
    return true;
  }

  if (
    proposedBottle.singleCask !== null &&
    candidate.singleCask !== proposedBottle.singleCask
  ) {
    return true;
  }

  if (proposedBottle.abv !== null && candidate.abv !== proposedBottle.abv) {
    return true;
  }

  if (
    proposedBottle.vintageYear !== null &&
    candidate.vintageYear !== proposedBottle.vintageYear
  ) {
    return true;
  }

  if (
    proposedBottle.releaseYear !== null &&
    candidate.releaseYear !== proposedBottle.releaseYear
  ) {
    return true;
  }

  return false;
}

function maybeBuildExistingBottleRepairDecision({
  price,
  decision,
  candidates,
}: {
  price: Pick<StorePrice, "bottleId">;
  decision: Extract<BottleClassificationDecision, { action: "create_bottle" }>;
  candidates: PriceMatchCandidate[];
}): StorePriceMatchDecision | null {
  if (price.bottleId === null || !decision.proposedBottle) {
    return null;
  }

  const currentBottleCandidate =
    candidates.find((candidate) => candidate.bottleId === price.bottleId) ??
    null;
  if (!currentBottleCandidate) {
    return null;
  }

  if (
    !candidateMatchesRepairDraftIdentity(
      currentBottleCandidate,
      parseClassifierProposedBottle(decision.proposedBottle),
    ) ||
    !candidateNeedsExistingBottleRepair(
      currentBottleCandidate,
      parseClassifierProposedBottle(decision.proposedBottle),
    )
  ) {
    return null;
  }

  return {
    action: "correction",
    confidence: null,
    rationale: appendRationale(
      decision.rationale,
      "The current bottle appears to be the right base identity, but its stored bottle metadata conflicts with the extracted traits. Review this as an existing-bottle repair instead of creating a duplicate bottle.",
    ),
    candidateBottleIds: decision.candidateBottleIds,
    identityScope: decision.identityScope,
    aliasScope: decision.aliasScope ?? "none",
    suggestedBottleId: price.bottleId,
    proposedBottle: buildClassifierBottleRepairDraft(decision.proposedBottle),
  };
}

/**
 * Converts classifier decisions into store-price match decisions while carrying
 * review metadata needed by later proposal handling.
 */
export function toStorePriceMatchDecision({
  price,
  decision,
  candidates,
}: {
  price: Pick<StorePrice, "bottleId">;
  decision: BottleClassificationDecision;
  candidates: PriceMatchCandidate[];
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

  if (decision.action === "repair_bottle") {
    const proposedBottle = buildClassifierBottleRepairDraft(
      decision.proposedBottle,
    );
    const candidate = candidates.find(
      ({ bottleId }) => bottleId === decision.matchedBottleId,
    );
    const needsRepair =
      candidate !== undefined &&
      proposedBottle !== null &&
      candidateNeedsExistingBottleRepair(candidate, proposedBottle);

    if (!needsRepair && price.bottleId === decision.matchedBottleId) {
      return {
        action: "match_existing",
        confidence: null,
        rationale: decision.rationale,
        candidateBottleIds: decision.candidateBottleIds,
        identityScope: decision.identityScope,
        aliasScope: decision.aliasScope ?? "none",
        suggestedBottleId: decision.matchedBottleId,
        proposedBottle: null,
      };
    }

    return {
      action: "correction",
      confidence: null,
      rationale: decision.rationale,
      candidateBottleIds: decision.candidateBottleIds,
      identityScope: decision.identityScope,
      aliasScope: decision.aliasScope ?? "none",
      suggestedBottleId: decision.matchedBottleId,
      proposedBottle: needsRepair ? proposedBottle : null,
    };
  }

  if (decision.action === "create_bottle") {
    const existingBottleRepair = maybeBuildExistingBottleRepairDecision({
      price,
      decision,
      candidates,
    });
    if (existingBottleRepair) {
      return existingBottleRepair;
    }

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

async function tryPersistStorePriceBottleCheck({
  attempt,
  classificationInput,
  classification,
  modelMetadata,
  price,
  proposal,
}: {
  attempt: { id: number; suggestedBottleId: number | null };
  classificationInput: ClassifyBottleReferenceInput;
  classification: BottleClassificationResult;
  modelMetadata: BottleReferenceRun["modelMetadata"];
  price: StorePrice;
  proposal: StorePriceMatchProposal;
}) {
  try {
    await createBottleCheck({
      intent: "resolve_reference",
      sourceKind: "store_price",
      sourceId: price.id,
      input: classificationInput,
      result: classification,
      storePrice: {
        attemptId: attempt.id,
      },
      model: proposal.model,
      modelMetadata,
    });
  } catch (error) {
    logError(error, {
      price: {
        id: price.id,
        name: price.name,
      },
      proposal: {
        id: proposal.id,
      },
      extra: {
        attemptId: attempt.id,
        phase: "persist_store_price_bottle_check",
      },
    });
  }
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

function buildStorePriceMatchConcreteInput(
  decision: StorePriceMatchDecision,
): ConcreteBottleCreateInput {
  if (decision.action !== "create_new" || decision.proposedBottle === null) {
    throw new Error(
      "Price match decision does not contain one concrete Bottle creation input.",
    );
  }

  return buildClassifierConcreteBottleInput(decision.proposedBottle);
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
    model: config.OPENAI_MODEL,
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
    concreteInput,
    user,
    creationSource,
    actor,
    expectedProcessingToken,
  }: {
    proposalId: number;
    concreteInput: ConcreteBottleCreateInput;
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
    await createOrReuseConcreteBottleInTransaction(tx, {
      creationSource,
      createdByActorId: writeActor.id,
      input: concreteInput,
      context: { user },
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
  concreteInput,
  user,
  creationSource = "price_match_review",
  actor,
  expectedProcessingToken,
}: {
  proposalId: number;
  concreteInput: ConcreteBottleCreateInput;
  user: User;
  creationSource?: CatalogVerificationCreationSource;
  actor: IncomingBottleDecisionActor;
  expectedProcessingToken?: string;
}) {
  const result = await db.transaction(async (tx) =>
    createBottleFromStorePriceMatchProposalInTransaction(tx, {
      proposalId,
      concreteInput,
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

export async function resolveStorePriceMatchProposal(
  priceId: number,
  {
    candidateExpansion = "open",
    force = false,
    generateBottleCheck = false,
    processingToken,
    reuseExistingExtraction = false,
  }: {
    candidateExpansion?: CandidateExpansionMode;
    force?: boolean;
    generateBottleCheck?: boolean;
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
  if (
    existingProposal &&
    CLOSED_STORE_PRICE_MATCH_PROPOSAL_STATUSES.includes(
      existingProposal.status,
    ) &&
    !force
  ) {
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
  const shouldGenerateBottleCheck =
    generateBottleCheck && config.BOTTLE_CHECK_SHADOW_GENERATION;
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
    if (reuseExistingExtraction) {
      classificationInput.extractedIdentity =
        parseStoredExtractedLabel(existingProposal);
    }

    const classificationRun = await runBottleReference(classificationInput);
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
      const ignoredResult = await db.transaction(async (tx) => {
        const proposal = await upsertIgnoredProposal(tx);
        const attempt = await recordStorePriceMatchAttempt({ proposal, tx });
        if (
          !canClearIgnoredStorePriceAssignment({ proposal, processingToken })
        ) {
          return { proposal, attempt };
        }

        if (price.bottleId !== null) {
          await clearIgnoredStorePriceAssignmentInTransaction(tx, {
            priceId: price.id,
            expectedBottleId,
          });
        }

        return { proposal, attempt };
      });
      if (shouldGenerateBottleCheck) {
        await tryPersistStorePriceBottleCheck({
          attempt: ignoredResult.attempt,
          classificationInput,
          classification,
          modelMetadata: classificationModelMetadata,
          price,
          proposal: ignoredResult.proposal,
        });
      }
      return ignoredResult.proposal;
    }

    const classifierDecision = normalizeClassifierDecisionForPriceMatching(
      classification.decision,
      candidates,
    );
    const decision = toStorePriceMatchDecision({
      price,
      decision: classifierDecision,
      candidates,
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
      webEvidenceJudgment:
        classification.decision.confidenceBasis?.webEvidence ?? null,
    });
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
    });
    const attempt = await recordStorePriceMatchAttempt({
      proposal,
      automationAssessment,
    });
    if (shouldGenerateBottleCheck) {
      await tryPersistStorePriceBottleCheck({
        attempt,
        classificationInput,
        classification,
        modelMetadata: classificationModelMetadata,
        price,
        proposal,
      });
    }

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

      const concreteInput = buildStorePriceMatchConcreteInput(decision);

      await createBottleFromStorePriceMatchProposal({
        proposalId: proposal.id,
        concreteInput,
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
    // The concrete Bottle writer acquires and validates the active Bottle graph
    // before the proposal and its consumers are locked below.
    const updateManifest = await updateConcreteBottleInTransaction(tx, {
      bottleId: repairBottleId,
      input: buildConcreteBottleRepairInput(proposedBottle),
      user,
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
  await finalizeConcreteBottleUpdate(updateManifest);

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
