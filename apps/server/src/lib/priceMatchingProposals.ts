import { inferBottleCreationTarget } from "@peated/bottle-classifier/bottleCreationDrafts";
import type {
  CandidateExpansionMode,
  ClassifyBottleReferenceInput,
} from "@peated/bottle-classifier/contract";
import {
  getReleaseObservationFacts,
  isAddingBottleLevelReleaseTraits,
} from "@peated/bottle-classifier/releaseIdentity";
import {
  BottleClassificationError,
  classifyBottleReference,
  isIgnoredBottleClassification,
  type BottleClassificationDecision,
} from "@peated/server/agents/bottleClassifier";
import config from "@peated/server/config";
import { db, type AnyDatabase, type AnyTransaction } from "@peated/server/db";
import {
  bottleObservations,
  bottleReleases,
  bottleSeries,
  bottles,
  bottlesToDistillers,
  changes,
  entities,
  storePriceMatchProposals,
  storePrices,
  type StorePrice,
  type StorePriceMatchProposal,
  type User,
} from "@peated/server/db/schema";
import {
  assignBottleAliasInTransaction,
  finalizeBottleAliasAssignment,
} from "@peated/server/lib/bottleAliases";
import { processSeries } from "@peated/server/lib/bottleHelpers";
import { queueEntityCreationVerification } from "@peated/server/lib/catalogVerification";
import {
  buildBottleInputFromProposedBottle,
  buildClassifierCreateInputs,
} from "@peated/server/lib/classifierDecisionCreateInputs";
import {
  BottleAlreadyExistsError,
  createBottleInTransaction,
  finalizeCreatedBottle,
} from "@peated/server/lib/createBottle";
import {
  BottleReleaseAlreadyExistsError,
  createBottleReleaseInTransaction,
  finalizeCreatedBottleRelease,
} from "@peated/server/lib/createBottleRelease";
import {
  coerceToUpsert,
  upsertBottleAlias,
  upsertEntity,
} from "@peated/server/lib/db";
import { formatBottleName, formatReleaseName } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
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
import { bottleNormalize } from "@peated/server/orpc/routes/bottles/validation";
import type {
  BottleInputSchema,
  BottleReleaseInputSchema,
  PriceMatchCandidateSchema,
  PriceMatchSearchEvidenceSchema,
  ProposedReleaseSchema,
  StorePriceMatchDecisionSchema,
} from "@peated/server/schemas";
import {
  ExtractedBottleDetailsSchema,
  ProposedBottleSchema,
} from "@peated/server/schemas";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, eq, inArray, sql } from "drizzle-orm";
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

function normalizeClassifierConfidence(confidence: number): number {
  const percentageConfidence = confidence <= 1 ? confidence * 100 : confidence;
  return Math.min(100, Math.max(0, Math.round(percentageConfidence)));
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

  return {
    ...decision,
    confidence: normalizeClassifierConfidence(decision.confidence),
  };
}

function buildBottleRepairInputFromProposedBottle(
  proposedBottle: ProposedBottle,
): Partial<z.infer<typeof BottleInputSchema>> {
  const proposedInput = buildBottleInputFromProposedBottle(proposedBottle);
  const repairInput: Partial<z.infer<typeof BottleInputSchema>> = {
    brand: proposedInput.brand,
    name: proposedInput.name,
  };

  if (proposedBottle.series !== null) {
    repairInput.series = proposedInput.series;
  }
  if (proposedBottle.category !== null) {
    repairInput.category = proposedInput.category;
  }
  if (proposedBottle.edition !== null) {
    repairInput.edition = proposedInput.edition;
  }
  if (proposedBottle.statedAge !== null) {
    repairInput.statedAge = proposedInput.statedAge;
  }
  if (proposedBottle.abv !== null) {
    repairInput.abv = proposedInput.abv;
  }
  if (proposedBottle.caskStrength !== null) {
    repairInput.caskStrength = proposedInput.caskStrength;
  }
  if (proposedBottle.singleCask !== null) {
    repairInput.singleCask = proposedInput.singleCask;
  }
  if (proposedBottle.vintageYear !== null) {
    repairInput.vintageYear = proposedInput.vintageYear;
  }
  if (proposedBottle.releaseYear !== null) {
    repairInput.releaseYear = proposedInput.releaseYear;
  }
  if (proposedBottle.caskType !== null) {
    repairInput.caskType = proposedInput.caskType;
  }
  if (proposedBottle.caskSize !== null) {
    repairInput.caskSize = proposedInput.caskSize;
  }
  if (proposedBottle.caskFill !== null) {
    repairInput.caskFill = proposedInput.caskFill;
  }
  if (proposedBottle.distillers.length > 0) {
    repairInput.distillers = proposedInput.distillers;
  }
  if (proposedBottle.bottler !== null) {
    repairInput.bottler = proposedInput.bottler;
  }

  return repairInput;
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
      decision.proposedBottle,
    ) ||
    !candidateNeedsExistingBottleRepair(
      currentBottleCandidate,
      decision.proposedBottle,
    )
  ) {
    return null;
  }

  return {
    action: "correction",
    confidence: decision.confidence,
    rationale: appendRationale(
      decision.rationale,
      "The current bottle appears to be the right base identity, but its stored bottle metadata conflicts with the extracted traits. Review this as an existing-bottle repair instead of creating a duplicate bottle.",
    ),
    candidateBottleIds: decision.candidateBottleIds,
    suggestedBottleId: price.bottleId,
    suggestedReleaseId: null,
    parentBottleId: null,
    creationTarget: null,
    proposedBottle: decision.proposedBottle,
    proposedRelease: null,
  };
}

function toStorePriceMatchDecision({
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
      confidence: decision.confidence,
      rationale: decision.rationale,
      candidateBottleIds: decision.candidateBottleIds,
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
      confidence: decision.confidence,
      rationale: decision.rationale,
      candidateBottleIds: decision.candidateBottleIds,
      suggestedBottleId: decision.matchedBottleId,
      suggestedReleaseId: null,
      parentBottleId: null,
      creationTarget: null,
      proposedBottle: decision.proposedBottle,
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
      confidence: decision.confidence,
      rationale: decision.rationale,
      candidateBottleIds: decision.candidateBottleIds,
      suggestedBottleId: null,
      suggestedReleaseId: null,
      parentBottleId: null,
      creationTarget: "bottle",
      proposedBottle: decision.proposedBottle,
      proposedRelease: null,
    };
  }

  if (decision.action === "create_release") {
    return {
      action: "create_new",
      confidence: decision.confidence,
      rationale: decision.rationale,
      candidateBottleIds: decision.candidateBottleIds,
      suggestedBottleId: null,
      suggestedReleaseId: null,
      parentBottleId: decision.parentBottleId,
      creationTarget: "release",
      proposedBottle: null,
      proposedRelease: decision.proposedRelease,
    };
  }

  if (decision.action === "create_bottle_and_release") {
    return {
      action: "create_new",
      confidence: decision.confidence,
      rationale: decision.rationale,
      candidateBottleIds: decision.candidateBottleIds,
      suggestedBottleId: null,
      suggestedReleaseId: null,
      parentBottleId: null,
      creationTarget: "bottle_and_release",
      proposedBottle: decision.proposedBottle,
      proposedRelease: decision.proposedRelease,
    };
  }

  return {
    action: "no_match",
    confidence: decision.confidence,
    rationale: decision.rationale,
    candidateBottleIds: decision.candidateBottleIds,
    suggestedBottleId: null,
    suggestedReleaseId: null,
    parentBottleId: null,
    creationTarget: null,
    proposedBottle: null,
    proposedRelease: null,
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
      decision.suggestedBottleId === price.bottleId &&
      (decision.suggestedReleaseId ?? null) === (price.releaseId ?? null)
    ) {
      return "match_existing";
    }
    return "correction";
  }
  return decision.action;
}

function getProposalStatus(
  price: StorePrice,
  decision: StorePriceMatchDecision,
  automationAssessment: StorePriceMatchAutomationAssessment | null,
): StorePriceMatchProposal["status"] {
  if (
    automationAssessment &&
    shouldVerifyStorePriceMatch({
      action: decision.action,
      currentBottleId: price.bottleId,
      currentReleaseId: price.releaseId ?? null,
      suggestedBottleId: decision.suggestedBottleId,
      suggestedReleaseId: decision.suggestedReleaseId ?? null,
      modelConfidence: decision.confidence,
      automationBlockers: automationAssessment.automationBlockers,
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
): Promise<StorePriceMatchProposal> {
  const proposal = await db.query.storePriceMatchProposals.findFirst({
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

async function getBottleForStorePriceRepairInTransaction(
  tx: AnyDatabase,
  bottleId: number,
) {
  const bottle = await tx.query.bottles.findFirst({
    where: eq(bottles.id, bottleId),
    with: {
      brand: true,
      bottler: true,
      series: true,
      bottlesToDistillers: {
        with: {
          distiller: true,
        },
      },
    },
  });

  if (!bottle) {
    throw new StorePriceBottleRepairBadRequestError("Bottle not found.");
  }

  return bottle;
}

async function syncBottleSeriesCountInTransaction(
  tx: AnyTransaction,
  seriesId: number,
) {
  await tx
    .update(bottleSeries)
    .set({
      numReleases: sql`(
        SELECT COUNT(*)
        FROM ${bottles}
        WHERE ${bottles.seriesId} = ${seriesId}
      )`,
    })
    .where(eq(bottleSeries.id, seriesId));
}

async function applyBottleRepairDraftInTransaction(
  tx: AnyTransaction,
  {
    bottleId,
    proposedBottle,
    user,
  }: {
    bottleId: number;
    proposedBottle: ProposedBottle;
    user: User;
  },
) {
  const bottle = await getBottleForStorePriceRepairInTransaction(tx, bottleId);
  const currentDistillers = bottle.bottlesToDistillers.map(
    (row) => row.distiller,
  );
  const repairInput = buildBottleRepairInputFromProposedBottle(proposedBottle);
  const currentInput = {
    name: bottle.name,
    series: bottle.seriesId ?? null,
    brand: bottle.brand.id,
    bottler: bottle.bottler?.id ?? null,
    edition: bottle.edition,
    statedAge: bottle.statedAge,
    abv: bottle.abv,
    caskStrength: bottle.caskStrength,
    singleCask: bottle.singleCask,
    category: bottle.category,
    flavorProfile: bottle.flavorProfile,
    distillers: currentDistillers.map((distiller) => distiller.id),
    vintageYear: bottle.vintageYear,
    releaseYear: bottle.releaseYear,
    caskType: bottle.caskType,
    caskSize: bottle.caskSize,
    caskFill: bottle.caskFill,
    description: bottle.description,
    descriptionSrc: bottle.descriptionSrc,
    imageUrl: bottle.imageUrl,
  };
  const normalizedInput: z.infer<typeof BottleInputSchema> = {
    ...currentInput,
    ...repairInput,
  };
  const bottleData: Record<string, any> = await bottleNormalize({
    input: normalizedInput,
    context: { user } as any,
    entityDb: tx,
  });

  bottleData.edition = normalizedInput.edition;
  bottleData.abv = normalizedInput.abv;
  bottleData.flavorProfile = normalizedInput.flavorProfile;
  bottleData.caskType = normalizedInput.caskType;
  bottleData.caskSize = normalizedInput.caskSize;
  bottleData.caskFill = normalizedInput.caskFill;

  if (!bottleData.name) {
    throw new StorePriceBottleRepairBadRequestError("Invalid bottle name.");
  }

  if (
    bottle.numReleases > 0 &&
    isAddingBottleLevelReleaseTraits({
      current: bottle,
      next: bottleData,
    })
  ) {
    throw new StorePriceBottleRepairBadRequestError(
      "Bottle-level release fields cannot be set while child releases exist. Move those details to bottle releases instead.",
    );
  }

  const newAliases: string[] = [];
  const newEntityIds = new Set<number>();

  const brandUpsert = await upsertEntity({
    db: tx,
    data: coerceToUpsert(bottleData.brand),
    creationSource: "price_match_review",
    userId: user.id,
    type: "brand",
  });
  if (!brandUpsert) {
    throw new StorePriceBottleRepairBadRequestError(
      "Could not identify brand.",
    );
  }
  if (brandUpsert.created) newEntityIds.add(brandUpsert.id);
  const brand = brandUpsert.result;

  let bottlerId: number | null = null;
  if (bottleData.bottler) {
    const bottlerUpsert = await upsertEntity({
      db: tx,
      data: coerceToUpsert(bottleData.bottler),
      creationSource: "price_match_review",
      userId: user.id,
      type: "bottler",
    });
    if (!bottlerUpsert) {
      throw new StorePriceBottleRepairBadRequestError(
        "Could not identify bottler.",
      );
    }
    if (bottlerUpsert.created) newEntityIds.add(bottlerUpsert.id);
    bottlerId = bottlerUpsert.id;
  }

  let seriesId: number | null = null;
  let seriesCreated = false;
  if (normalizedInput.series) {
    [seriesId, seriesCreated] = await processSeries({
      series: normalizedInput.series,
      brand,
      userId: user.id,
      tx,
    });
  }

  const distillerIds: number[] = [];
  const newDistillerIds: number[] = [];
  for (const distillerData of bottleData.distillers ?? []) {
    const distillerUpsert = await upsertEntity({
      db: tx,
      data: coerceToUpsert(distillerData),
      creationSource: "price_match_review",
      userId: user.id,
      type: "distiller",
    });
    if (!distillerUpsert) {
      throw new StorePriceBottleRepairBadRequestError(
        "Could not identify distiller.",
      );
    }
    if (distillerUpsert.created) newEntityIds.add(distillerUpsert.id);
    distillerIds.push(distillerUpsert.id);
  }

  const currentDistillerIds = currentDistillers.map(
    (distiller) => distiller.id,
  );
  for (const distillerId of distillerIds) {
    if (currentDistillerIds.includes(distillerId)) {
      continue;
    }

    await tx.insert(bottlesToDistillers).values({
      bottleId: bottle.id,
      distillerId,
    });
    newDistillerIds.push(distillerId);
  }

  for (const distillerId of currentDistillerIds) {
    if (distillerIds.includes(distillerId)) {
      continue;
    }

    await tx
      .delete(bottlesToDistillers)
      .where(
        and(
          eq(bottlesToDistillers.distillerId, distillerId),
          eq(bottlesToDistillers.bottleId, bottle.id),
        ),
      );
  }

  const fullName = formatBottleName({
    ...bottleData,
    name: `${brand.shortName || brand.name} ${bottleData.name}`,
  });
  const fullNameChanged = fullName !== bottle.fullName;
  const nameChanged = bottleData.name !== bottle.name;
  const statedAgeChanged = bottleData.statedAge !== bottle.statedAge;
  const canonicalAlias = await upsertBottleAlias(tx, fullName, bottle.id);
  if (canonicalAlias.bottleId && canonicalAlias.bottleId !== bottle.id) {
    throw new BottleAlreadyExistsError(canonicalAlias.bottleId);
  }
  if (fullNameChanged) {
    newAliases.push(canonicalAlias.name);
  }

  if (fullNameChanged || nameChanged || statedAgeChanged) {
    const releases = await tx.query.bottleReleases.findMany({
      where: eq(bottleReleases.bottleId, bottle.id),
    });

    for (const release of releases) {
      const nextReleaseName = formatReleaseName({
        name: bottleData.name,
        edition: release.edition,
        abv: release.abv,
        statedAge: bottleData.statedAge ? null : release.statedAge,
        releaseYear: release.releaseYear,
        vintageYear: release.vintageYear,
        singleCask: release.singleCask,
        caskStrength: release.caskStrength,
        caskFill: release.caskFill,
        caskType: release.caskType,
        caskSize: release.caskSize,
      });
      const nextReleaseFullName = formatReleaseName({
        name: fullName,
        edition: release.edition,
        abv: release.abv,
        statedAge: bottleData.statedAge ? null : release.statedAge,
        releaseYear: release.releaseYear,
        vintageYear: release.vintageYear,
        singleCask: release.singleCask,
        caskStrength: release.caskStrength,
        caskFill: release.caskFill,
        caskType: release.caskType,
        caskSize: release.caskSize,
      });

      await tx
        .update(bottleReleases)
        .set({
          name: nextReleaseName,
          fullName: nextReleaseFullName,
        })
        .where(eq(bottleReleases.id, release.id));

      const releaseAlias = await upsertBottleAlias(
        tx,
        nextReleaseFullName,
        bottle.id,
        release.id,
      );
      if (
        releaseAlias.bottleId !== bottle.id ||
        (releaseAlias.releaseId ?? null) !== release.id
      ) {
        throw new StorePriceBottleRepairBadRequestError(
          "Release alias already belongs to a different bottle.",
        );
      }
      newAliases.push(nextReleaseFullName);
    }
  }

  const [updatedBottle] = await tx
    .update(bottles)
    .set({
      name: bottleData.name,
      fullName,
      statedAge: bottleData.statedAge,
      seriesId,
      category: bottleData.category,
      brandId: brand.id,
      bottlerId,
      flavorProfile: bottleData.flavorProfile,
      edition: bottleData.edition,
      abv: bottleData.abv,
      singleCask: bottleData.singleCask,
      caskStrength: bottleData.caskStrength,
      vintageYear: bottleData.vintageYear,
      releaseYear: bottleData.releaseYear,
      caskSize: bottleData.caskSize,
      caskType: bottleData.caskType,
      caskFill: bottleData.caskFill,
      updatedAt: sql`NOW()`,
    })
    .where(eq(bottles.id, bottle.id))
    .returning();

  if (!updatedBottle) {
    throw new StorePriceBottleRepairBadRequestError(
      "Failed to update bottle repair draft.",
    );
  }

  if (bottle.seriesId && bottle.seriesId !== seriesId) {
    await syncBottleSeriesCountInTransaction(tx, bottle.seriesId);
  }
  if (!seriesCreated && seriesId && seriesId !== bottle.seriesId) {
    await syncBottleSeriesCountInTransaction(tx, seriesId);
  }

  await tx.insert(changes).values({
    objectType: "bottle",
    objectId: updatedBottle.id,
    createdById: user.id,
    displayName: updatedBottle.fullName,
    type: "update",
    data: {
      ...bottleData,
      distillerIds: newDistillerIds,
      source: "price_match_review",
    },
  });

  return {
    bottle: updatedBottle,
    newAliases,
    newEntityIds: Array.from(newEntityIds),
    seriesCreated,
  };
}

async function finalizeStorePriceBottleRepair({
  bottle,
  newAliases,
  newEntityIds,
  seriesCreated,
}: Awaited<ReturnType<typeof applyBottleRepairDraftInTransaction>>) {
  try {
    await pushUniqueJob(
      "OnBottleChange",
      { bottleId: bottle.id },
      { delay: 5000 },
    );
  } catch (err) {
    logError(err, {
      bottle: {
        id: bottle.id,
      },
    });
  }

  if (bottle.seriesId && seriesCreated) {
    try {
      await pushUniqueJob("IndexBottleSeriesSearchVectors", {
        seriesId: bottle.seriesId,
      });
    } catch (err) {
      logError(err, {
        bottle: {
          id: bottle.id,
        },
        series: {
          id: bottle.seriesId,
        },
      });
    }
  }

  for (const aliasName of newAliases) {
    try {
      await pushUniqueJob(
        "OnBottleAliasChange",
        { name: aliasName },
        { delay: 5000 },
      );
    } catch (err) {
      logError(err, {
        bottle: {
          id: bottle.id,
        },
      });
    }
  }

  for (const entityId of newEntityIds) {
    try {
      await pushUniqueJob("OnEntityChange", { entityId }, { delay: 5000 });
    } catch (err) {
      logError(err, {
        entity: {
          id: entityId,
        },
      });
    }

    try {
      await queueEntityCreationVerification({
        entityId,
        creationSource: "price_match_review",
      });
    } catch (err) {
      logError(err, {
        entity: {
          id: entityId,
        },
      });
    }
  }
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
    createdById,
  }: {
    proposal: StorePriceMatchProposalForReview;
    bottleId: number;
    releaseId?: number | null;
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
  expectedProcessingToken,
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
  expectedProcessingToken?: string;
  tx?: AnyDatabase;
}) {
  const proposalType = decision ? getProposalType(price, decision) : "no_match";
  const status =
    statusOverride ??
    (decision
      ? getProposalStatus(price, decision, automationAssessment ?? null)
      : "errored");
  const creationTarget =
    decision?.action === "create_new"
      ? (decision.creationTarget ?? null)
      : null;
  const enteredQueueAt = shouldTrackStorePriceQueueEntry(status)
    ? sql`NOW()`
    : null;
  const proposalValues = {
    status,
    proposalType,
    confidence: decision?.confidence ?? null,
    currentBottleId: price.bottleId,
    currentReleaseId: price.releaseId ?? null,
    suggestedBottleId: decision?.suggestedBottleId ?? null,
    suggestedReleaseId: decision?.suggestedReleaseId ?? null,
    parentBottleId:
      decision?.action === "create_new"
        ? (decision.parentBottleId ?? null)
        : null,
    creationTarget,
    candidateBottles: candidates,
    extractedLabel,
    proposedBottle: decision?.proposedBottle ?? null,
    proposedRelease: decision?.proposedRelease ?? null,
    searchEvidence: searchEvidence || [],
    automationAssessment: automationAssessment ?? null,
    rationale: decision?.rationale ?? null,
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
    return await reloadStorePriceMatchProposalByPriceId(price.id);
  }

  return proposal;
}

async function clearIgnoredStorePriceAssignmentInTransaction(
  tx: AnyDatabase,
  {
    priceId,
    expectedBottleId,
    expectedReleaseId,
  }: {
    priceId: number;
    expectedBottleId: number | null;
    expectedReleaseId: number | null;
  },
) {
  await tx
    .update(storePrices)
    .set({
      bottleId: null,
      releaseId: null,
      updatedAt: sql`NOW()`,
    })
    .where(
      and(
        eq(storePrices.id, priceId),
        expectedBottleId === null
          ? sql`${storePrices.bottleId} IS NULL`
          : eq(storePrices.bottleId, expectedBottleId),
        sql`${storePrices.releaseId} IS NOT DISTINCT FROM ${expectedReleaseId}`,
      ),
    );
}

async function getExistingBottleReleaseInTransaction(
  tx: AnyDatabase,
  {
    releaseId,
    bottleId,
  }: {
    releaseId: number;
    bottleId: number;
  },
) {
  const release = await tx.query.bottleReleases.findFirst({
    where: eq(bottleReleases.id, releaseId),
  });

  if (!release || release.bottleId !== bottleId) {
    throw new Error(
      `Bottle release not found for existing price match proposal result (${releaseId}).`,
    );
  }

  return release;
}

async function createBottleFromStorePriceMatchProposalInTransaction(
  tx: AnyTransaction,
  {
    proposalId,
    input,
    releaseInput,
    user,
    expectedProcessingToken,
  }: {
    proposalId: number;
    input?: z.infer<typeof BottleInputSchema>;
    releaseInput?: z.infer<typeof BottleReleaseInputSchema>;
    user: User;
    expectedProcessingToken?: string;
  },
) {
  const proposal = await getStorePriceMatchProposalForReviewInTransaction(tx, {
    proposalId,
    expectedProposalType: "create_new",
    allowedStatuses: ["pending_review"],
    expectedProcessingToken,
  });

  const creationTarget = inferBottleCreationTarget({
    bottle: input,
    release: releaseInput,
  });

  if (!creationTarget) {
    throw new Error(
      `Missing proposed bottle or release input for price match proposal (${proposal.id}).`,
    );
  }

  let createResult: Awaited<
    ReturnType<typeof createBottleInTransaction>
  > | null = null;
  let createReleaseResult: Awaited<
    ReturnType<typeof createBottleReleaseInTransaction>
  > | null = null;
  let existingRelease:
    | Awaited<ReturnType<typeof createBottleReleaseInTransaction>>["release"]
    | null = null;
  let resolvedBottleId = proposal.parentBottleId;
  let resolvedReleaseId: number | null = null;

  if (creationTarget === "bottle" || creationTarget === "bottle_and_release") {
    if (!input) {
      throw new Error(
        `Missing proposed bottle input for price match proposal (${proposal.id}).`,
      );
    }

    try {
      createResult = await createBottleInTransaction(tx, {
        creationSource: "price_match_review",
        input,
        context: {
          user,
        },
      });
      resolvedBottleId = createResult.bottle.id;
    } catch (err) {
      if (!(err instanceof BottleAlreadyExistsError)) {
        throw err;
      }

      resolvedBottleId = err.bottleId;
    }
  }

  if (creationTarget === "release" || creationTarget === "bottle_and_release") {
    if (!releaseInput) {
      throw new Error(
        `Missing proposed release input for price match proposal (${proposal.id}).`,
      );
    }

    const releaseBottleId =
      creationTarget === "release" ? proposal.parentBottleId : resolvedBottleId;

    if (!releaseBottleId) {
      throw new Error(
        `Missing parent bottle for release creation (${proposal.id}).`,
      );
    }

    try {
      createReleaseResult = await createBottleReleaseInTransaction(tx, {
        bottleId: releaseBottleId,
        input: releaseInput,
        user,
      });
      resolvedBottleId = createReleaseResult.release.bottleId;
      resolvedReleaseId = createReleaseResult.release.id;
    } catch (err) {
      if (!(err instanceof BottleReleaseAlreadyExistsError)) {
        throw err;
      }

      existingRelease = await getExistingBottleReleaseInTransaction(tx, {
        releaseId: err.releaseId,
        bottleId: releaseBottleId,
      });
      resolvedBottleId = existingRelease.bottleId;
      resolvedReleaseId = existingRelease.id;
    }
  }

  if (createResult) {
    resolvedBottleId = createResult.bottle.id;
  }

  if (!resolvedBottleId) {
    throw new Error(
      `Unable to resolve bottle id for price match proposal (${proposal.id}).`,
    );
  }

  const aliasResult = await applyApprovedStorePriceMatchProposalInTransaction(
    tx,
    {
      proposal,
      bottleId: resolvedBottleId,
      releaseId: resolvedReleaseId,
      reviewedById: user.id,
    },
  );

  return {
    createResult,
    createReleaseResult,
    existingRelease,
    aliasResult,
    resolvedBottleId,
    resolvedReleaseId,
  };
}

export async function createBottleFromStorePriceMatchProposal({
  proposalId,
  input,
  releaseInput,
  user,
  expectedProcessingToken,
}: {
  proposalId: number;
  input?: z.infer<typeof BottleInputSchema>;
  releaseInput?: z.infer<typeof BottleReleaseInputSchema>;
  user: User;
  expectedProcessingToken?: string;
}) {
  const result = await db.transaction(async (tx) =>
    createBottleFromStorePriceMatchProposalInTransaction(tx, {
      proposalId,
      input,
      releaseInput,
      user,
      expectedProcessingToken,
    }),
  );

  if (result.createResult) {
    await finalizeCreatedBottle(result.createResult, {
      creationSource: "price_match_review",
    });
  }
  if (result.createReleaseResult) {
    await finalizeCreatedBottleRelease(result.createReleaseResult);
  }
  const aliasContexts: Record<string, Record<string, any>> = {};
  if (result.createResult) {
    aliasContexts.bottle = {
      id: result.createResult.bottle.id,
    };
  }
  if (result.createReleaseResult) {
    aliasContexts.release = {
      id: result.createReleaseResult.release.id,
    };
  }
  await finalizeBottleAliasAssignment(
    result.aliasResult,
    Object.keys(aliasContexts).length ? aliasContexts : undefined,
  );

  return {
    bottle:
      result.createResult?.bottle ??
      (await db.query.bottles.findFirst({
        where: eq(bottles.id, result.resolvedBottleId),
      }))!,
    release: result.createReleaseResult?.release ?? result.existingRelease,
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

    extractedLabel = classification.artifacts.extractedIdentity;
    candidates = classification.artifacts.candidates;
    searchEvidence = classification.artifacts.searchEvidence;

    if (isIgnoredBottleClassification(classification)) {
      return await db.transaction(async (tx) => {
        const proposal = await upsertStorePriceMatchProposal({
          price,
          extractedLabel,
          candidates,
          searchEvidence,
          statusOverride: "ignored",
          expectedProcessingToken: processingToken,
          tx,
        });

        if (
          !canClearIgnoredStorePriceAssignment({ proposal, processingToken })
        ) {
          return proposal;
        }

        if (price.bottleId !== null || price.releaseId !== null) {
          await clearIgnoredStorePriceAssignmentInTransaction(tx, {
            priceId: price.id,
            expectedBottleId: price.bottleId,
            expectedReleaseId: price.releaseId ?? null,
          });
        }

        return proposal;
      });
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
    });
    const proposal = await upsertStorePriceMatchProposal({
      price,
      extractedLabel,
      candidates,
      decision,
      automationAssessment,
      searchEvidence,
      expectedProcessingToken: processingToken,
    });

    const shouldAutoCreate = shouldAutoCreateStorePriceMatchProposal({
      decision,
      automationAssessment,
    });

    if (proposal.status !== "verified" && !shouldAutoCreate) {
      return proposal;
    }

    try {
      const automationUser = await getAutomationModeratorUser();

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

      return await upsertStorePriceMatchProposal({
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
    }
  } catch (err) {
    logError(err, {
      price: {
        id: price.id,
        name: price.name,
      },
    });

    return await upsertStorePriceMatchProposal({
      price,
      extractedLabel:
        err instanceof BottleClassificationError
          ? err.artifacts.extractedIdentity
          : extractedLabel,
      candidates:
        err instanceof BottleClassificationError
          ? err.artifacts.candidates
          : candidates,
      searchEvidence:
        err instanceof BottleClassificationError
          ? err.artifacts.searchEvidence
          : searchEvidence,
      error: err instanceof Error ? err.message : "Unknown classifier error",
      expectedProcessingToken: processingToken,
    });
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

async function markApprovedStorePriceMatchProposalsInTransaction(
  tx: AnyDatabase,
  {
    proposalId,
    externalSiteId,
    name,
    bottleId,
    releaseId,
    reviewedById,
    volume,
  }: {
    proposalId: number;
    externalSiteId: number;
    name: string;
    bottleId: number;
    releaseId: number | null;
    reviewedById: number;
    volume: number;
  },
) {
  await tx
    .update(storePriceMatchProposals)
    .set({
      status: "approved",
      currentBottleId: bottleId,
      currentReleaseId: releaseId,
      suggestedBottleId: bottleId,
      suggestedReleaseId: releaseId,
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

  await tx.execute(sql`
    UPDATE ${storePriceMatchProposals}
    SET
      status = 'approved',
      current_bottle_id = ${bottleId},
      current_release_id = ${releaseId},
      suggested_bottle_id = ${bottleId},
      suggested_release_id = ${releaseId},
      processing_token = NULL,
      processing_queued_at = NULL,
      processing_expires_at = NULL,
      proposal_type = 'match_existing'::store_price_match_proposal_type,
      parent_bottle_id = NULL,
      creation_target = NULL,
      proposed_release = NULL,
      reviewed_by_id = ${reviewedById},
      reviewed_at = NOW(),
      updated_at = NOW(),
      error = NULL
    FROM ${storePrices}
    WHERE ${storePrices.id} = ${storePriceMatchProposals.priceId}
      AND ${storePriceMatchProposals.id} <> ${proposalId}
      AND ${storePrices.externalSiteId} = ${externalSiteId}
      AND LOWER(${storePrices.name}) = LOWER(${name})
      AND ${storePrices.volume} = ${volume}
      AND ${storePriceMatchProposals.status} IN ('pending_review', 'errored')
      AND (${storePriceMatchProposals.processingExpiresAt} IS NULL OR ${storePriceMatchProposals.processingExpiresAt} <= NOW())
  `);
}

export async function applyApprovedStorePriceMatchProposalInTransaction(
  tx: AnyDatabase,
  {
    proposal,
    bottleId,
    releaseId = null,
    reviewedById,
  }: {
    proposal: StorePriceMatchProposalForReview;
    bottleId: number;
    releaseId?: number | null;
    reviewedById: number;
  },
) {
  if (releaseId !== null) {
    const release = await tx.query.bottleReleases.findFirst({
      where: eq(bottleReleases.id, releaseId),
    });

    if (!release || release.bottleId !== bottleId) {
      throw new Error(
        `Release ${releaseId} does not belong to bottle ${bottleId}.`,
      );
    }
  }

  // Store listing names stay bottle-level unless an existing canonical release
  // alias already owns the same text, which assignBottleAliasInTransaction preserves.
  const aliasResult = await assignBottleAliasInTransaction(tx, {
    bottleId,
    releaseId,
    aliasReleaseId: null,
    externalSiteId: proposal.price.externalSiteId,
    name: proposal.price.name,
    volume: proposal.price.volume,
  });

  await markApprovedStorePriceMatchProposalsInTransaction(tx, {
    proposalId: proposal.id,
    externalSiteId: proposal.price.externalSiteId,
    name: proposal.price.name,
    bottleId,
    releaseId,
    reviewedById,
    volume: proposal.price.volume,
  });

  // One approved store price should always leave behind one source record keyed
  // by the store_price id so moderators can recover the original evidence later.
  await upsertStorePriceObservationInTransaction(tx, {
    proposal,
    bottleId,
    releaseId,
    createdById: reviewedById,
  });

  return aliasResult;
}

export async function applyApprovedStorePriceMatchInTransaction(
  tx: AnyDatabase,
  {
    proposalId,
    bottleId,
    releaseId,
    reviewedById,
    expectedProcessingToken,
  }: {
    proposalId: number;
    bottleId: number;
    releaseId?: number | null;
    reviewedById: number;
    expectedProcessingToken?: string;
  },
) {
  const proposal = await getStorePriceMatchProposalForReviewInTransaction(tx, {
    proposalId,
    expectedProcessingToken,
  });

  return await applyApprovedStorePriceMatchProposalInTransaction(tx, {
    proposal,
    bottleId,
    releaseId,
    reviewedById,
  });
}

export async function applyApprovedStorePriceMatch({
  proposalId,
  bottleId,
  releaseId,
  reviewedById,
  expectedProcessingToken,
}: {
  proposalId: number;
  bottleId: number;
  releaseId?: number | null;
  reviewedById: number;
  expectedProcessingToken?: string;
}) {
  const aliasResult = await db.transaction(async (tx) =>
    applyApprovedStorePriceMatchInTransaction(tx, {
      proposalId,
      bottleId,
      releaseId,
      reviewedById,
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

export async function applyStorePriceBottleRepairFromProposal({
  proposalId,
  user,
  expectedProcessingToken,
}: {
  proposalId: number;
  user: User;
  expectedProcessingToken?: string;
}) {
  const { repairResult, aliasResult } = await db.transaction(async (tx) => {
    const proposal = await getStorePriceMatchProposalForReviewInTransaction(
      tx,
      {
        proposalId,
        expectedProposalType: "correction",
        expectedProcessingToken,
      },
    );
    const proposedBottle = getStorePriceBottleRepairDraft(proposal);
    const repairedBottle = await applyBottleRepairDraftInTransaction(tx, {
      bottleId: proposal.currentBottleId!,
      proposedBottle,
      user,
    });
    const approvedAliasResult =
      await applyApprovedStorePriceMatchProposalInTransaction(tx, {
        proposal,
        bottleId: repairedBottle.bottle.id,
        releaseId: null,
        reviewedById: user.id,
      });

    return {
      repairResult: repairedBottle,
      aliasResult: approvedAliasResult,
    };
  });

  await finalizeBottleAliasAssignment(aliasResult, {
    bottle: {
      id: repairResult.bottle.id,
    },
  });
  await finalizeStorePriceBottleRepair(repairResult);

  return repairResult.bottle;
}

export async function ignoreStorePriceMatchProposal({
  proposalId,
  reviewedById,
}: {
  proposalId: number;
  reviewedById: number;
}) {
  await db.transaction(async (tx) => {
    await getStorePriceMatchProposalForReviewInTransaction(tx, {
      proposalId,
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
