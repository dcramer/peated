import type {
  CandidateExpansionMode,
  ClassifyBottleReferenceInput,
} from "@peated/bottle-classifier/contract";
import type { WebEvidenceJudgment } from "@peated/bottle-classifier/priceMatchingEvidence";
import { getReleaseObservationFacts } from "@peated/bottle-classifier/releaseIdentity";
import type { CatalogVerificationCreationSource } from "@peated/catalog-verifier";
import {
  BottleClassificationError,
  classifyBottleReference,
  isIgnoredBottleClassification,
  type BottleClassificationDecision,
} from "@peated/server/agents/bottleClassifier";
import config from "@peated/server/config";
import { db, type AnyDatabase, type AnyTransaction } from "@peated/server/db";
import {
  actors,
  bottleObservations,
  bottleReleases,
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
import {
  CatalogTargetResolutionError,
  lockCatalogTargetAssignmentDescriptorInTransaction,
  lockCatalogTargetAssignmentDescriptorsInTransaction,
  resolveCatalogTargetForAssignment,
  type CatalogTargetAssignmentDescriptor,
} from "@peated/server/lib/catalogTargets";
import {
  buildBottleInputFromProposedBottle,
  buildClassifierCreateInputs,
} from "@peated/server/lib/classifierDecisionCreateInputs";
import {
  BottleAlreadyExistsError,
  createConcreteBottleInTransaction,
  finalizeCreatedBottle,
} from "@peated/server/lib/createBottle";
import {
  recordIncomingBottleDecisionInTransaction,
  shouldRecordIncomingBottleDecision,
  type IncomingBottleDecisionActor,
  type IncomingBottleDecisionType,
} from "@peated/server/lib/incomingBottleDecisionLog";
import { logError } from "@peated/server/lib/log";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import { buildPriceMatchConcreteBottleInput } from "@peated/server/lib/priceMatchConcreteBottleInput";
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
import { getAutomationModeratorUser } from "@peated/server/lib/systemUser";
import {
  finalizeConcreteBottleUpdate,
  updateConcreteBottleInTransaction,
  type ConcreteBottleUpdateInput,
} from "@peated/server/lib/updateConcreteBottle";
import type {
  BottleInputSchema,
  BottleReleaseInputSchema,
  PriceMatchSearchEvidenceSchema,
  ProposedReleaseSchema,
} from "@peated/server/schemas";
import {
  ExtractedBottleDetailsSchema,
  PriceMatchCandidateSchema,
  ProposedBottleSchema,
  StorePriceMatchDecisionSchema,
} from "@peated/server/schemas";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, eq, inArray, sql } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import type { z } from "zod";

type ExtractedBottleDetails = z.infer<typeof ExtractedBottleDetailsSchema>;
type PriceMatchCandidate = z.infer<typeof PriceMatchCandidateSchema>;
type SearchEvidence = z.infer<typeof PriceMatchSearchEvidenceSchema>;
type ProposedBottle = z.infer<typeof ProposedBottleSchema>;
type ProposedRelease = z.infer<typeof ProposedReleaseSchema>;
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

function withStoreCaskBottleDefaults(
  proposedBottle: BottleClassificationDecision["proposedBottle"],
): ProposedBottle | null {
  return proposedBottle
    ? {
        ...proposedBottle,
        caskType: null,
        caskSize: null,
        caskFill: null,
      }
    : null;
}

function withStoreCaskReleaseDefaults(
  proposedRelease: BottleClassificationDecision["proposedRelease"],
): ProposedRelease | null {
  return proposedRelease
    ? {
        ...proposedRelease,
        caskType: null,
        caskSize: null,
        caskFill: null,
      }
    : null;
}

function withStoreExtractedLabelDefaults(
  extractedLabel: ClassifyBottleReferenceInput["extractedIdentity"],
): ExtractedBottleDetails | null {
  return extractedLabel
    ? {
        ...extractedLabel,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
      }
    : null;
}

function withStoreCandidateDefaults(candidate: unknown): PriceMatchCandidate {
  return PriceMatchCandidateSchema.parse({
    ...(candidate as Record<string, unknown>),
    caskType: null,
    caskSize: null,
    caskFill: null,
  });
}

function withStoreCandidateDefaultsList(
  candidates: unknown[],
): PriceMatchCandidate[] {
  return candidates.map(withStoreCandidateDefaults);
}

function parseStoredExtractedLabel(
  proposal: StorePriceMatchProposal | null | undefined,
): ExtractedBottleDetails | null {
  if (!proposal?.extractedLabel) {
    return null;
  }

  const parsed = ExtractedBottleDetailsSchema.safeParse(
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

  if (
    decision.action === "match" &&
    decision.matchedReleaseId != null &&
    !candidates.some(
      (candidate) => candidate.releaseId === decision.matchedReleaseId,
    )
  ) {
    throw new Error(
      `Classifier returned unknown suggested release id (${decision.matchedReleaseId}).`,
    );
  }

  // Price matching consumes the classifier's reviewed result. Keep the adapter
  // layer limited to persistence compatibility checks instead of re-running
  // classifier policy here.
  if (
    decision.action === "create_release" &&
    !candidates.some(
      (candidate) => candidate.bottleId === decision.parentBottleId,
    )
  ) {
    throw new Error(
      `Classifier returned unknown parent bottle id (${decision.parentBottleId}).`,
    );
  }

  if (
    decision.action === "repair_parent_and_create_release" &&
    !candidates.some(
      (candidate) => candidate.bottleId === decision.parentBottleId,
    )
  ) {
    throw new Error(
      `Classifier returned unknown repair parent bottle id (${decision.parentBottleId}).`,
    );
  }

  return decision;
}

/**
 * Maps the sparse legacy parent/stable repair draft to canonical shared and
 * exact patches. Unknown null fields or empty distiller lists are omitted
 * rather than cleared.
 */
function buildConcreteBottleRepairInput(
  proposedBottle: ProposedBottle,
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
    shared.statedAge = proposedBottle.statedAge;
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
  const candidateNames = [
    candidate.alias,
    candidate.bottleFullName,
    candidate.fullName,
  ].filter((value): value is string => Boolean(value));

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
    proposedBottle.caskType !== null &&
    candidate.caskType !== proposedBottle.caskType
  ) {
    return true;
  }

  if (
    proposedBottle.caskSize !== null &&
    candidate.caskSize !== proposedBottle.caskSize
  ) {
    return true;
  }

  if (
    proposedBottle.caskFill !== null &&
    candidate.caskFill !== proposedBottle.caskFill
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
  price: Pick<StorePrice, "bottleId" | "releaseId">;
  decision: Extract<BottleClassificationDecision, { action: "create_bottle" }>;
  candidates: PriceMatchCandidate[];
}): StorePriceMatchDecision | null {
  if (
    price.bottleId === null ||
    price.releaseId !== null ||
    !decision.proposedBottle
  ) {
    return null;
  }

  const currentBottleCandidate =
    candidates.find(
      (candidate) =>
        candidate.bottleId === price.bottleId &&
        (candidate.releaseId == null || candidate.kind === "bottle"),
    ) ?? null;
  if (!currentBottleCandidate) {
    return null;
  }

  if (
    !candidateMatchesRepairDraftIdentity(
      currentBottleCandidate,
      withStoreCaskBottleDefaults(decision.proposedBottle)!,
    ) ||
    !candidateNeedsExistingBottleRepair(
      currentBottleCandidate,
      withStoreCaskBottleDefaults(decision.proposedBottle)!,
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
    suggestedReleaseId: null,
    parentBottleId: null,
    creationTarget: null,
    proposedBottle: withStoreCaskBottleDefaults(decision.proposedBottle),
    proposedRelease: null,
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
  price: Pick<StorePrice, "bottleId" | "releaseId">;
  decision: BottleClassificationDecision;
  candidates: PriceMatchCandidate[];
}): StorePriceMatchDecision {
  if (decision.action === "match") {
    const action =
      price.bottleId !== null &&
      (price.bottleId !== decision.matchedBottleId ||
        price.releaseId !== decision.matchedReleaseId)
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
      suggestedReleaseId: decision.matchedReleaseId,
      parentBottleId: null,
      creationTarget: null,
      proposedBottle: null,
      proposedRelease: null,
    };
  }

  if (decision.action === "repair_bottle") {
    return {
      action: "correction",
      confidence: null,
      rationale: decision.rationale,
      candidateBottleIds: decision.candidateBottleIds,
      identityScope: decision.identityScope,
      aliasScope: decision.aliasScope ?? "none",
      suggestedBottleId: decision.matchedBottleId,
      suggestedReleaseId: null,
      parentBottleId: null,
      creationTarget: null,
      proposedBottle: withStoreCaskBottleDefaults(decision.proposedBottle),
      proposedRelease: null,
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
      suggestedReleaseId: null,
      parentBottleId: null,
      creationTarget: "bottle",
      proposedBottle: withStoreCaskBottleDefaults(decision.proposedBottle),
      proposedRelease: null,
    };
  }

  if (decision.action === "create_release") {
    return {
      action: "create_new",
      confidence: null,
      rationale: decision.rationale,
      candidateBottleIds: decision.candidateBottleIds,
      identityScope: decision.identityScope,
      aliasScope: decision.aliasScope ?? "none",
      suggestedBottleId: null,
      suggestedReleaseId: null,
      parentBottleId: decision.parentBottleId,
      creationTarget: "release",
      proposedBottle: null,
      proposedRelease: withStoreCaskReleaseDefaults(decision.proposedRelease),
    };
  }

  if (decision.action === "create_bottle_and_release") {
    return {
      action: "create_new",
      confidence: null,
      rationale: decision.rationale,
      candidateBottleIds: decision.candidateBottleIds,
      identityScope: decision.identityScope,
      aliasScope: decision.aliasScope ?? "none",
      suggestedBottleId: null,
      suggestedReleaseId: null,
      parentBottleId: null,
      creationTarget: "bottle_and_release",
      proposedBottle: withStoreCaskBottleDefaults(decision.proposedBottle),
      proposedRelease: withStoreCaskReleaseDefaults(decision.proposedRelease),
    };
  }

  if (decision.action === "repair_parent_and_create_release") {
    // Price matching cannot apply this compound mutation yet, but review still
    // needs the parent repair and child release drafts intact.
    return {
      action: "no_match",
      confidence: null,
      rationale: appendRationale(
        decision.rationale,
        "Classifier found that the safe outcome requires repairing the existing parent bottle before creating a release; price matching cannot persist that compound repair yet.",
      ),
      candidateBottleIds: decision.candidateBottleIds,
      identityScope: decision.identityScope,
      aliasScope: decision.aliasScope ?? "none",
      suggestedBottleId: null,
      suggestedReleaseId: null,
      parentBottleId: decision.parentBottleId,
      creationTarget: null,
      proposedBottle: withStoreCaskBottleDefaults(decision.proposedBottle),
      proposedRelease: withStoreCaskReleaseDefaults(decision.proposedRelease),
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
    suggestedReleaseId: null,
    parentBottleId: null,
    creationTarget: null,
    proposedBottle: null,
    proposedRelease: null,
  };
}

function isReviewOnlyParentRepairDecision(
  decision: StorePriceMatchDecision,
): boolean {
  return (
    decision.action === "no_match" &&
    decision.parentBottleId !== null &&
    decision.parentBottleId !== undefined &&
    decision.proposedBottle !== null &&
    decision.proposedBottle !== undefined &&
    decision.proposedRelease !== null &&
    decision.proposedRelease !== undefined
  );
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
  // Compound parent repair proposals stay unresolved even when the price has a
  // current assignment; correction apply paths only handle simple bottle repair.
  if (isReviewOnlyParentRepairDecision(decision)) {
    return "no_match";
  }

  if (decision.action === "create_new") {
    return "create_new";
  }

  if (price.bottleId) {
    if (
      decision.action === "match_existing" &&
      decision.suggestedBottleId === price.bottleId &&
      (decision.suggestedReleaseId ?? null) === (price.releaseId ?? null)
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
      currentReleaseId: price.releaseId ?? null,
      identityScope: decision.identityScope,
      suggestedBottleId: decision.suggestedBottleId,
      suggestedReleaseId: decision.suggestedReleaseId ?? null,
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
  await tx.insert(storePriceMatchAttempts).values({
    priceId: proposal.priceId,
    proposalId: proposal.id,
    proposalType: proposal.proposalType,
    initialStatus: proposal.status,
    finalStatus: getInitialAttemptFinalStatus(proposal.status),
    confidence: proposal.confidence,
    currentBottleId: proposal.currentBottleId,
    currentReleaseId: proposal.currentReleaseId,
    currentTargetId: proposal.currentTargetId,
    suggestedBottleId: proposal.suggestedBottleId,
    suggestedReleaseId: proposal.suggestedReleaseId,
    suggestedTargetId: proposal.suggestedTargetId,
    parentBottleId: proposal.parentBottleId,
    creationTarget: proposal.creationTarget,
    automationEligible: automationAssessment?.automationEligible ?? false,
    automationScore: automationAssessment?.automationScore ?? null,
    model: proposal.model,
    error: proposal.error,
    reviewedById: proposal.reviewedById,
    reviewedAt: proposal.reviewedAt,
  });
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
      targetId: number;
      bottleId: number;
      releaseId: number | null;
    };
  },
) {
  await tx.execute(sql`
    UPDATE ${storePriceMatchAttempts}
    SET
      final_status = ${finalStatus},
      reviewed_by_id = ${reviewedById ?? null},
      error = COALESCE(${error ?? null}, error),
      current_target_id = CASE
        WHEN ${assignment !== undefined} THEN ${assignment?.targetId ?? null}
        ELSE current_target_id
      END,
      current_bottle_id = CASE
        WHEN ${assignment !== undefined} THEN ${assignment?.bottleId ?? null}
        ELSE current_bottle_id
      END,
      current_release_id = CASE
        WHEN ${assignment !== undefined} THEN ${assignment?.releaseId ?? null}
        ELSE current_release_id
      END,
      suggested_target_id = CASE
        WHEN ${assignment !== undefined} THEN ${assignment?.targetId ?? null}
        ELSE suggested_target_id
      END,
      suggested_bottle_id = CASE
        WHEN ${assignment !== undefined} THEN ${assignment?.bottleId ?? null}
        ELSE suggested_bottle_id
      END,
      suggested_release_id = CASE
        WHEN ${assignment !== undefined} THEN ${assignment?.releaseId ?? null}
        ELSE suggested_release_id
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
    (decision.proposedBottle !== null || decision.proposedRelease !== null) &&
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

function buildStorePriceMatchCreateInputs(decision: StorePriceMatchDecision) {
  if (decision.action !== "create_new") {
    return {
      input: undefined,
      releaseInput: undefined,
    };
  }

  // Callers sanitize create_new decisions first, so these drafts are already
  // normalized and aligned with the explicit bottle-vs-release target.
  return buildClassifierCreateInputs(
    decision.creationTarget === "bottle"
      ? {
          action: "create_bottle",
          proposedBottle: decision.proposedBottle!,
        }
      : decision.creationTarget === "release"
        ? {
            action: "create_release",
            proposedRelease: decision.proposedRelease!,
          }
        : {
            action: "create_bottle_and_release",
            proposedBottle: decision.proposedBottle!,
            proposedRelease: decision.proposedRelease!,
          },
  );
}

function getStorePriceBottleRepairDraft(
  proposal: StorePriceMatchProposalForReview,
): ProposedBottle {
  if (
    proposal.currentBottleId === null ||
    proposal.suggestedBottleId === null ||
    proposal.currentBottleId !== proposal.suggestedBottleId ||
    proposal.currentReleaseId !== null ||
    proposal.suggestedReleaseId !== null ||
    proposal.proposedRelease !== null
  ) {
    throw new StorePriceBottleRepairBadRequestError(
      "Price match proposal is not an existing-bottle repair.",
    );
  }

  const parsedBottle = ProposedBottleSchema.safeParse(proposal.proposedBottle);
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
    "proposalType" | "creationTarget" | "proposedBottle" | "proposedRelease"
  >,
) {
  const releaseObservationSource =
    proposal.proposedRelease ??
    (proposal.proposedBottle as Partial<ProposedRelease> | null);
  const releaseFacts = releaseObservationSource
    ? getReleaseObservationFacts(releaseObservationSource)
    : {};

  return {
    proposalType: proposal.proposalType,
    creationTarget: proposal.creationTarget,
    proposedBottle: proposal.proposedBottle ?? null,
    proposedRelease: proposal.proposedRelease ?? null,
    releaseFacts,
  };
}

async function upsertStorePriceObservationInTransaction(
  tx: AnyDatabase,
  {
    proposal,
    bottleId,
    releaseId = null,
    targetId,
    createdById,
  }: {
    proposal: StorePriceMatchProposalForReview;
    bottleId: number;
    releaseId?: number | null;
    targetId: number | null;
    createdById: number;
  },
) {
  // Preserve the exact store listing as evidence even when the canonical alias
  // stays bottle-level. Approval should capture facts without forcing a split.
  const [observation] = await tx
    .insert(bottleObservations)
    .values({
      bottleId,
      releaseId,
      targetId,
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
        releaseId,
        targetId,
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
  const creationTarget =
    parsedDecision?.action === "create_new"
      ? (parsedDecision.creationTarget ?? null)
      : null;
  const enteredQueueAt = shouldTrackStorePriceQueueEntry(status)
    ? sql`NOW()`
    : null;
  const proposalValues = {
    status,
    proposalType,
    confidence: parsedDecision?.confidence ?? null,
    currentBottleId: price.bottleId,
    currentReleaseId: price.releaseId ?? null,
    currentTargetId: price.targetId,
    suggestedBottleId: parsedDecision?.suggestedBottleId ?? null,
    suggestedReleaseId: parsedDecision?.suggestedReleaseId ?? null,
    suggestedTargetId: null,
    parentBottleId: parsedDecision?.parentBottleId ?? null,
    creationTarget,
    aliasScope: parsedDecision?.aliasScope ?? null,
    candidateBottles: candidates,
    extractedLabel,
    proposedBottle: parsedDecision?.proposedBottle ?? null,
    proposedRelease: parsedDecision?.proposedRelease ?? null,
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
  const updateValues = {
    ...proposalValues,
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

/** Conditionally clears one complete durable StorePrice identity snapshot. */
async function clearIgnoredStorePriceAssignmentInTransaction(
  tx: AnyDatabase,
  {
    priceId,
    expectedIdentity,
  }: {
    priceId: number;
    expectedIdentity: Pick<StorePrice, "targetId" | "bottleId" | "releaseId">;
  },
) {
  await tx
    .update(storePrices)
    .set({
      targetId: null,
      bottleId: null,
      releaseId: null,
      updatedAt: sql`NOW()`,
    })
    .where(
      and(
        eq(storePrices.id, priceId),
        // Catalog identity is one CAS snapshot; partial matches must not clear it.
        sql`${storePrices.targetId} IS NOT DISTINCT FROM ${expectedIdentity.targetId}`,
        sql`${storePrices.bottleId} IS NOT DISTINCT FROM ${expectedIdentity.bottleId}`,
        sql`${storePrices.releaseId} IS NOT DISTINCT FROM ${expectedIdentity.releaseId}`,
      ),
    );
}

async function createBottleFromStorePriceMatchProposalInTransaction(
  tx: AnyTransaction,
  {
    proposalId,
    input,
    releaseInput,
    user,
    creationSource,
    actor,
    expectedProcessingToken,
  }: {
    proposalId: number;
    input?: z.infer<typeof BottleInputSchema>;
    releaseInput?: z.infer<typeof BottleReleaseInputSchema>;
    user: User;
    creationSource: CatalogVerificationCreationSource;
    actor: IncomingBottleDecisionActor;
    expectedProcessingToken?: string;
  },
) {
  const preflight = await getStorePriceMatchProposalTargetPreflight(
    tx,
    proposalId,
  );
  const { creationTarget, input: concreteInput } =
    buildPriceMatchConcreteBottleInput({
      bottleInput: input,
      releaseInput,
      parentBottleId: preflight.parentBottleId,
    });

  const writeActor = await getPriceMatchWriteActorForDatabase(tx, actor, {
    userId: user.id,
    allowSystemActor: creationSource === "price_match_automation",
  });

  let createResult: Awaited<
    ReturnType<typeof createConcreteBottleInTransaction>
  > | null = null;
  let resolvedBottle;
  let resolvedTarget: CatalogTargetAssignmentDescriptor;
  try {
    // The nested transaction is a savepoint: duplicate preparation may have
    // mutated canonical helpers, and all of it must roll back before reuse.
    createResult = await tx.transaction(async (creationTx) =>
      createConcreteBottleInTransaction(creationTx, {
        creationSource,
        createdByActorId: writeActor.id,
        input: concreteInput,
        context: { user },
      }),
    );
    resolvedBottle = createResult.bottle;
    resolvedTarget = {
      targetId: createResult.exactTarget.id,
      groupId: createResult.group.id,
      bottleId: createResult.bottle.id,
    };
  } catch (error) {
    if (!(error instanceof BottleAlreadyExistsError)) throw error;
    // Only exact canonical-name collisions are reusable; aliases and SMWS codes
    // remain conflicts, and source reuse must stay inside its trusted group.
    if (
      error.collision?.kind !== "canonical_name" ||
      error.collision.attemptedCanonicalFullName === null
    ) {
      throw error;
    }

    const existingTarget = await resolveCatalogTargetForAssignment(
      { kind: "bottle", bottleId: error.bottleId },
      tx,
    );
    if (concreteInput.kind === "source_bottle") {
      const sourceTarget = await resolveCatalogTargetForAssignment(
        { kind: "bottle", bottleId: concreteInput.sourceBottleId },
        tx,
      );
      await lockCatalogTargetAssignmentDescriptorsInTransaction(tx, [
        sourceTarget,
        existingTarget,
      ]);
      if (sourceTarget.groupId !== existingTarget.groupId) throw error;
    } else {
      await lockCatalogTargetAssignmentDescriptorInTransaction(
        tx,
        existingTarget,
        { composition: "concrete_bottle_mutation" },
      );
    }
    const existingBottle = await tx.query.bottles.findFirst({
      where: eq(bottles.id, error.bottleId),
    });
    if (
      !existingBottle ||
      existingBottle.fullName !== error.collision.attemptedCanonicalFullName
    ) {
      throw error;
    }

    resolvedBottle = existingBottle;
    resolvedTarget = existingTarget;
  }

  const proposal = await getStorePriceMatchProposalForReviewInTransaction(tx, {
    proposalId,
    expectedProposalType: "create_new",
    allowedStatuses: ["pending_review"],
    expectedProcessingToken,
  });
  if (
    proposal.priceId !== preflight.priceId ||
    proposal.parentBottleId !== preflight.parentBottleId ||
    proposal.price.targetId !== preflight.price.targetId ||
    proposal.price.bottleId !== preflight.price.bottleId ||
    proposal.price.releaseId !== preflight.price.releaseId ||
    proposal.creationTarget !== preflight.creationTarget ||
    !isDeepStrictEqual(proposal.proposedBottle, preflight.proposedBottle) ||
    !isDeepStrictEqual(proposal.proposedRelease, preflight.proposedRelease)
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
        createdRelease: false,
        metadata: {
          creationTarget,
          creationSource,
          reusedExistingBottle: !createResult,
        },
      },
      targetAssignment: {
        target: resolvedTarget,
        consumerIdentity: {
          bottleId: resolvedBottle.id,
          releaseId: null,
        },
      },
    },
  );

  return {
    createResult,
    aliasResult,
    bottle: resolvedBottle,
    targetId: resolvedTarget.targetId,
  };
}

export async function createBottleFromStorePriceMatchProposal({
  proposalId,
  input,
  releaseInput,
  user,
  creationSource = "price_match_review",
  actor,
  expectedProcessingToken,
}: {
  proposalId: number;
  input?: z.infer<typeof BottleInputSchema>;
  releaseInput?: z.infer<typeof BottleReleaseInputSchema>;
  user: User;
  creationSource?: CatalogVerificationCreationSource;
  actor: IncomingBottleDecisionActor;
  expectedProcessingToken?: string;
}) {
  const result = await db.transaction(async (tx) =>
    createBottleFromStorePriceMatchProposalInTransaction(tx, {
      proposalId,
      input,
      releaseInput,
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
    targetId: result.targetId,
  };
}

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
  let ignoredClassification = false;

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
        currentReleaseId: price.releaseId ?? null,
      },
    };
    if (candidateExpansion !== "open") {
      classificationInput.candidateExpansion = candidateExpansion;
    }
    if (reuseExistingExtraction) {
      classificationInput.extractedIdentity =
        parseStoredExtractedLabel(existingProposal);
    }

    const classification = await classifyBottleReference(classificationInput);

    extractedLabel = withStoreExtractedLabelDefaults(
      classification.artifacts.extractedIdentity,
    );
    candidates = withStoreCandidateDefaultsList(
      classification.artifacts.candidates,
    );
    searchEvidence = classification.artifacts.searchEvidence;

    if (isIgnoredBottleClassification(classification)) {
      ignoredClassification = true;
      const expectedIdentity = {
        targetId: price.targetId,
        bottleId: price.bottleId,
        releaseId: price.releaseId,
      };
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
      /** Returns a replacement owner's proposal, or requires locked drift proof for the active owner. */
      const persistIgnoredResultIfIdentityDrifted = async (
        resolutionError: CatalogTargetResolutionError,
      ) =>
        await db.transaction(async (tx) => {
          // Recovery keeps the canonical proposal-before-StorePrice lock order.
          const proposal = await upsertIgnoredProposal(tx);
          if (
            !canClearIgnoredStorePriceAssignment({ proposal, processingToken })
          ) {
            await recordStorePriceMatchAttempt({ proposal, tx });
            return proposal;
          }

          const [currentIdentity] = await tx
            .select({
              targetId: storePrices.targetId,
              bottleId: storePrices.bottleId,
              releaseId: storePrices.releaseId,
            })
            .from(storePrices)
            .where(eq(storePrices.id, price.id))
            .limit(1)
            .for("update");

          // Suppress target failure only after locked proof of complete-tuple drift.
          if (
            !currentIdentity ||
            (currentIdentity.targetId === expectedIdentity.targetId &&
              currentIdentity.bottleId === expectedIdentity.bottleId &&
              currentIdentity.releaseId === expectedIdentity.releaseId)
          ) {
            throw resolutionError;
          }

          await recordStorePriceMatchAttempt({ proposal, tx });
          return proposal;
        });

      try {
        let targetAssignment: CatalogTargetAssignmentDescriptor | null = null;
        if (expectedIdentity.targetId !== null) {
          targetAssignment = await resolveCatalogTargetForAssignment({
            kind: "target",
            targetId: expectedIdentity.targetId,
          });
        }

        return await db.transaction(async (tx) => {
          if (targetAssignment) {
            await lockCatalogTargetAssignmentDescriptorsInTransaction(tx, [
              targetAssignment,
            ]);
          }

          const proposal = await upsertIgnoredProposal(tx);
          await recordStorePriceMatchAttempt({ proposal, tx });
          if (
            !canClearIgnoredStorePriceAssignment({ proposal, processingToken })
          ) {
            return proposal;
          }

          if (
            expectedIdentity.targetId !== null ||
            expectedIdentity.bottleId !== null ||
            expectedIdentity.releaseId !== null
          ) {
            await clearIgnoredStorePriceAssignmentInTransaction(tx, {
              priceId: price.id,
              expectedIdentity,
            });
          }

          return proposal;
        });
      } catch (error) {
        if (!(error instanceof CatalogTargetResolutionError)) {
          throw error;
        }

        return await persistIgnoredResultIfIdentityDrifted(error);
      }
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
      suggestedReleaseId: decision.suggestedReleaseId ?? null,
      candidateBottles: candidates,
      extractedLabel,
      proposedBottle: decision.proposedBottle,
      proposedRelease: decision.proposedRelease ?? null,
      creationTarget:
        decision.action === "create_new"
          ? (decision.creationTarget ?? null)
          : null,
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
    await recordStorePriceMatchAttempt({
      proposal,
      automationAssessment,
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
            `Unable to auto-approve verified price match proposal without a suggested bottle (${proposal.id}).`,
          );
        }

        await applyApprovedStorePriceMatch({
          proposalId: proposal.id,
          bottleId: proposal.suggestedBottleId,
          releaseId: proposal.suggestedReleaseId ?? null,
          reviewedById: automationUser.id,
          actor: await getPeatedSystemActor(),
          allowSystemActor: true,
          expectedProcessingToken: processingToken,
        });

        return await reloadStorePriceMatchProposal(proposal.id);
      }

      const createInputs = buildStorePriceMatchCreateInputs(decision);
      if (!createInputs.input && !createInputs.releaseInput) {
        throw new Error(
          `Unable to auto-create price match proposal without creation inputs (${proposal.id}).`,
        );
      }

      await createBottleFromStorePriceMatchProposal({
        proposalId: proposal.id,
        ...createInputs,
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

      const erroredProposal = await upsertStorePriceMatchProposal({
        price,
        extractedLabel,
        candidates,
        decision,
        automationAssessment,
        searchEvidence,
        error:
          err instanceof Error
            ? err.message
            : proposal.status === "verified"
              ? "Unknown auto-approval error"
              : "Unknown auto-create error",
        statusOverride: "errored",
        expectedProcessingToken: processingToken,
      });
      await db.transaction(async (tx) => {
        await markLatestStorePriceMatchAttemptFinalInTransaction(tx, {
          proposalId: erroredProposal.id,
          finalStatus: "errored",
          reviewedById: automationUser?.id ?? null,
          error: erroredProposal.error,
        });
      });
      return erroredProposal;
    }
  } catch (err) {
    if (ignoredClassification && err instanceof CatalogTargetResolutionError) {
      // Owned unchanged invalid targets are integrity failures, not classifier errors.
      throw err;
    }

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
          ? withStoreExtractedLabelDefaults(err.artifacts.extractedIdentity)
          : extractedLabel,
      candidates:
        err instanceof BottleClassificationError
          ? withStoreCandidateDefaultsList(err.artifacts.candidates)
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
async function getStorePriceMatchProposalTargetPreflight(
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
    releaseId,
    targetId,
    reviewedById,
  }: {
    proposalId: number;
    bottleId: number;
    releaseId: number | null;
    targetId: number;
    reviewedById: number;
  },
) {
  await tx
    .update(storePriceMatchProposals)
    .set({
      status: "approved",
      currentBottleId: bottleId,
      currentReleaseId: releaseId,
      currentTargetId: targetId,
      suggestedBottleId: bottleId,
      suggestedReleaseId: releaseId,
      suggestedTargetId: targetId,
      parentBottleId: null,
      creationTarget: null,
      proposedRelease: null,
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
    assignment: { targetId, bottleId, releaseId },
  });
}

type StorePriceApprovalTargetAssignment = {
  target: CatalogTargetAssignmentDescriptor;
  consumerIdentity: {
    bottleId: number;
    releaseId: number | null;
  };
};

/**
 * Applies one approved proposal using its caller-resolved CatalogTarget; the
 * selected assignment owns the retained consumer identity pair.
 */
export async function applyApprovedStorePriceMatchProposalInTransaction(
  tx: AnyTransaction,
  {
    proposal,
    reviewedById,
    allowSystemActor = false,
    decisionLog,
    targetAssignment,
  }: {
    proposal: StorePriceMatchProposalForReview;
    reviewedById: number;
    allowSystemActor?: boolean;
    decisionLog: {
      actor: IncomingBottleDecisionActor;
      decision: IncomingBottleDecisionType;
      createdBottle?: boolean;
      createdRelease?: boolean;
      metadata?: Record<string, unknown>;
    };
    targetAssignment: StorePriceApprovalTargetAssignment;
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

  const { bottleId, releaseId } = targetAssignment.consumerIdentity;
  const { target } = targetAssignment;

  const aliasKey = normalizeBottleAliasKey(proposal.price.name);
  // Alias-safety gate: a newly assigned listing title only becomes a reusable
  // global alias when the decision asserted `aliasScope = global_alias`. For
  // "none"/null/missing scope the source listing is still assigned (backfilled)
  // and retained for provenance, but the new alias is marked ignored so a
  // generic retailer title cannot be reused for future listings. Aliases that
  // are already assigned to this target keep their existing ignored state.
  const reusableGlobalAlias = proposal.aliasScope === "global_alias";
  const aliasInput = {
    externalSiteId: proposal.price.externalSiteId,
    name: aliasKey,
    backfillNames: [proposal.price.name],
    volume: proposal.price.volume,
    ignored: !reusableGlobalAlias,
    assignmentSource: "source_approved",
    assignedByActorId: actor.id,
  } satisfies Omit<
    Parameters<typeof assignBottleAliasInTransaction>[1],
    | "target"
    | "targetId"
    | "consumerIdentity"
    | "bottleId"
    | "releaseId"
    | "aliasReleaseId"
    | "context"
  >;
  const aliasResult = await assignBottleAliasInTransaction(tx, {
    ...aliasInput,
    target,
    consumerIdentity: targetAssignment.consumerIdentity,
  });

  await markApprovedStorePriceMatchProposalInTransaction(tx, {
    proposalId: proposal.id,
    bottleId,
    releaseId,
    targetId: target.targetId,
    reviewedById,
  });

  // One approved store price should always leave behind one source record keyed
  // by the store_price id so moderators can recover the original evidence later.
  await upsertStorePriceObservationInTransaction(tx, {
    proposal,
    bottleId,
    releaseId,
    targetId: target.targetId,
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
      releaseId,
      targetId: target.targetId,
      createdBottle: decisionLog.createdBottle ?? false,
      createdRelease: decisionLog.createdRelease ?? false,
      confidence: proposal.confidence,
      model: proposal.model,
      rationale: proposal.rationale,
      metadata: {
        proposalType: proposal.proposalType,
        creationTarget: proposal.creationTarget,
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
    releaseId,
    reviewedById,
    actor,
    allowSystemActor = false,
    expectedProcessingToken,
  }: {
    proposalId: number;
    bottleId: number;
    releaseId?: number | null;
    reviewedById: number;
    actor: IncomingBottleDecisionActor;
    allowSystemActor?: boolean;
    expectedProcessingToken?: string;
  },
) {
  const resolvedTarget = await resolveCatalogTargetForAssignment(
    {
      kind: "legacy",
      bottleId,
      releaseId: releaseId ?? null,
      context: {
        caller: "priceMatchingProposals",
        operation: "approveStorePriceMatch",
      },
    },
    tx,
  );
  // Generic group merge locks identity before aliases and consumers. Taking
  // the same identity lock before the proposal/price row prevents inversion.
  await lockCatalogTargetAssignmentDescriptorInTransaction(tx, resolvedTarget);

  const proposal = await getStorePriceMatchProposalForReviewInTransaction(tx, {
    proposalId,
    expectedProcessingToken,
  });

  return await applyApprovedStorePriceMatchProposalInTransaction(tx, {
    proposal,
    reviewedById,
    allowSystemActor,
    targetAssignment: {
      target: resolvedTarget,
      consumerIdentity: { bottleId, releaseId: releaseId ?? null },
    },
    decisionLog: {
      actor,
      decision: "match_existing",
    },
  });
}

export async function applyApprovedStorePriceMatch({
  proposalId,
  bottleId,
  releaseId,
  reviewedById,
  actor,
  allowSystemActor = false,
  expectedProcessingToken,
}: {
  proposalId: number;
  bottleId: number;
  releaseId?: number | null;
  reviewedById: number;
  actor: IncomingBottleDecisionActor;
  allowSystemActor?: boolean;
  expectedProcessingToken?: string;
}) {
  const aliasResult = await db.transaction(async (tx) =>
    applyApprovedStorePriceMatchInTransaction(tx, {
      proposalId,
      bottleId,
      releaseId,
      reviewedById,
      actor,
      allowSystemActor,
      expectedProcessingToken,
    }),
  );

  const aliasContexts: Record<string, Record<string, any>> = {
    bottle: {
      id: bottleId,
    },
  };
  if (releaseId) {
    aliasContexts.release = {
      id: releaseId,
    };
  }
  await finalizeBottleAliasAssignment(aliasResult, aliasContexts);
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
    const preflight = await getStorePriceMatchProposalTargetPreflight(
      tx,
      proposalId,
    );
    const preflightHasRepairIdentity =
      REVIEWABLE_STORE_PRICE_MATCH_PROPOSAL_STATUSES.some(
        (status) => status === preflight.status,
      ) &&
      preflight.proposalType === "correction" &&
      preflight.currentBottleId !== null &&
      preflight.currentBottleId === preflight.suggestedBottleId &&
      preflight.currentReleaseId === null &&
      preflight.suggestedReleaseId === null &&
      preflight.proposedRelease === null;
    const resolvedTarget = preflightHasRepairIdentity
      ? await resolveCatalogTargetForAssignment(
          {
            kind: "legacy",
            bottleId: preflight.currentBottleId!,
            releaseId: preflight.currentReleaseId,
            context: {
              caller: "priceMatchingProposals",
              operation: "approveStorePriceBottleRepair",
            },
          },
          tx,
        )
      : null;
    if (resolvedTarget) {
      // Compose with updateConcreteBottleInTransaction's group-first lifecycle
      // before acquiring the proposal lock below.
      await lockCatalogTargetAssignmentDescriptorInTransaction(
        tx,
        resolvedTarget,
        { composition: "concrete_bottle_mutation" },
      );
    }

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
      proposal.currentReleaseId !== preflight.currentReleaseId ||
      proposal.suggestedBottleId !== preflight.suggestedBottleId ||
      proposal.suggestedReleaseId !== preflight.suggestedReleaseId
    ) {
      throw new StorePriceBottleRepairBadRequestError(
        "Price match proposal identity changed during approval.",
      );
    }
    const proposedBottle = getStorePriceBottleRepairDraft(proposal);
    if (!resolvedTarget) {
      throw new StorePriceBottleRepairBadRequestError(
        "Price match proposal identity changed during approval.",
      );
    }
    const writeActor = await getPriceMatchWriteActorForDatabase(tx, actor, {
      userId: user.id,
    });
    const updateManifest = await updateConcreteBottleInTransaction(tx, {
      bottleId: proposal.currentBottleId!,
      input: buildConcreteBottleRepairInput(proposedBottle),
      user,
      actorId: writeActor.id,
      creationSource: "price_match_review",
    });
    const approvedAliasResult =
      await applyApprovedStorePriceMatchProposalInTransaction(tx, {
        proposal,
        reviewedById: user.id,
        targetAssignment: {
          target: resolvedTarget,
          consumerIdentity: {
            bottleId: updateManifest.bottle.id,
            releaseId: null,
          },
        },
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

export async function getProposalTargets(
  proposalList: Pick<
    StorePriceMatchProposal,
    | "currentBottleId"
    | "suggestedBottleId"
    | "parentBottleId"
    | "currentReleaseId"
    | "suggestedReleaseId"
  >[],
) {
  const bottleIds = Array.from(
    new Set(
      proposalList.flatMap((proposal) =>
        [
          proposal.currentBottleId,
          proposal.suggestedBottleId,
          proposal.parentBottleId,
        ].filter((id): id is number => !!id),
      ),
    ),
  );
  const releaseIds = Array.from(
    new Set(
      proposalList.flatMap((proposal) =>
        [proposal.currentReleaseId, proposal.suggestedReleaseId].filter(
          (id): id is number => !!id,
        ),
      ),
    ),
  );

  const [bottleList, releaseList] = await Promise.all([
    bottleIds.length
      ? db.query.bottles.findMany({
          where: inArray(bottles.id, bottleIds),
          with: {
            brand: true,
            bottler: true,
            series: true,
          },
        })
      : Promise.resolve([]),
    releaseIds.length
      ? db.query.bottleReleases.findMany({
          where: inArray(bottleReleases.id, releaseIds),
        })
      : Promise.resolve([]),
  ]);

  return {
    bottleList,
    releaseList,
  };
}
