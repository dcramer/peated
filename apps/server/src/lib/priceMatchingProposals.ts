import { inferBottleCreationTarget } from "@peated/bottle-classifier/bottleCreationDrafts";
import {
  normalizeBottle,
  normalizeString,
} from "@peated/bottle-classifier/normalize";
import {
  DEFAULT_PRICE_MATCH_CREATION_TARGET,
  getReleaseObservationFacts,
} from "@peated/bottle-classifier/releaseIdentity";
import { parseDetailsFromName } from "@peated/bottle-classifier/smws";
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
  bottles,
  entities,
  externalSites,
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
import {
  createBottleInTransaction,
  finalizeCreatedBottle,
} from "@peated/server/lib/createBottle";
import {
  createBottleReleaseInTransaction,
  finalizeCreatedBottleRelease,
} from "@peated/server/lib/createBottleRelease";
import { logError } from "@peated/server/lib/log";
import {
  getStorePriceMatchAutomationAssessment,
  shouldVerifyStorePriceMatch,
  type StorePriceMatchAutomationAssessment,
} from "@peated/server/lib/priceMatchingAutomation";
import { getBottleMatchCandidateById } from "@peated/server/lib/priceMatchingCandidates";
import {
  hasActiveStorePriceMatchProposalProcessingLease,
  refreshStorePriceMatchProposalProcessingLease,
  releaseStorePriceMatchProposalProcessingLease,
} from "@peated/server/lib/priceMatchingProcessingLease";
import {
  CLOSED_STORE_PRICE_MATCH_PROPOSAL_STATUSES,
  REVIEWABLE_STORE_PRICE_MATCH_PROPOSAL_STATUSES,
} from "@peated/server/lib/priceMatchingStatus";
import { getAutomationModeratorUser } from "@peated/server/lib/systemUser";
import type {
  BottleInputSchema,
  BottleReleaseInputSchema,
  ExtractedBottleDetailsSchema,
  PriceMatchCandidateSchema,
  PriceMatchSearchEvidenceSchema,
  ProposedReleaseSchema,
  StorePriceMatchDecisionSchema,
} from "@peated/server/schemas";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";

const SMWS_EXTERNAL_SITE_TYPE = "smws";
const SMWS_BRAND_NAME = "The Scotch Malt Whisky Society";
const NON_WHISKY_LISTING_KEYWORDS =
  /\b(vodka|gin|rum|tequila|mezcal|sotol|soju|baijiu|sake|shochu|brandy|cognac|armagnac|liqueur)\b/i;
const WHISKY_LISTING_KEYWORDS =
  /\b(whisk(?:e)?y|single malt|single grain|single pot still|bourbon|rye|scotch|malt whisky|malt whiskey)\b/i;

type ExtractedBottleDetails = z.infer<typeof ExtractedBottleDetailsSchema>;
type PriceMatchCandidate = z.infer<typeof PriceMatchCandidateSchema>;
type SearchEvidence = z.infer<typeof PriceMatchSearchEvidenceSchema>;
type ProposedRelease = z.infer<typeof ProposedReleaseSchema>;
type StorePriceMatchDecision = z.infer<typeof StorePriceMatchDecisionSchema>;
type ProposedBottleDraft = NonNullable<
  StorePriceMatchDecision["proposedBottle"]
>;
type BottleCreateInput = z.infer<typeof BottleInputSchema>;
type StorePriceMatchProposalForReview = StorePriceMatchProposal & {
  price: StorePrice;
};

function buildBottleEntityInput(
  choice: {
    id: number | null;
    name: string;
  },
  entityType: "brand" | "distiller" | "bottler",
): BottleCreateInput["brand"] {
  return (
    choice.id ?? {
      name: choice.name,
      type: [entityType],
      description: null,
      shortName: null,
      location: null,
      address: null,
      yearEstablished: null,
      website: null,
      country: null,
      region: null,
    }
  );
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

function shouldAutoIgnoreTrivialNonWhiskyListing(name: string): boolean {
  // Keep this fast path limited to obvious non-whisky categories. Flavored
  // whisky detection intentionally stays model-driven because retailer titles
  // are too inconsistent for regex heuristics to be reliable there.
  const normalizedName = normalizeString(name).toLowerCase();
  return (
    NON_WHISKY_LISTING_KEYWORDS.test(normalizedName) &&
    !WHISKY_LISTING_KEYWORDS.test(normalizedName)
  );
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

function toStorePriceMatchDecision({
  price,
  decision,
}: {
  price: Pick<StorePrice, "bottleId" | "releaseId">;
  decision: BottleClassificationDecision;
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

  if (decision.action === "create_bottle") {
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
      price,
      suggestedBottleId: decision.suggestedBottleId,
      suggestedReleaseId: decision.suggestedReleaseId ?? null,
      automationScore: automationAssessment.automationScore,
    })
  ) {
    return "verified";
  }
  return "pending_review";
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

async function findEntityChoiceByName(name: string) {
  const entity = await db.query.entities.findFirst({
    where: eq(sql`LOWER(${entities.name})`, name.toLowerCase()),
  });

  return entity
    ? {
        id: entity.id,
        name: entity.name,
      }
    : null;
}

async function findTrustedSmwsBottleId(name: string): Promise<number | null> {
  const [match] = await db
    .select({
      bottleId: bottles.id,
    })
    .from(bottles)
    .innerJoin(entities, eq(entities.id, bottles.brandId))
    .where(
      and(
        eq(sql`LOWER(${entities.name})`, SMWS_BRAND_NAME.toLowerCase()),
        eq(sql`LOWER(${bottles.name})`, name.toLowerCase()),
      ),
    )
    .limit(1);

  return match?.bottleId ?? null;
}

async function maybeResolveTrustedSmwsStorePriceMatch(
  price: StorePrice,
  {
    processingToken,
  }: {
    processingToken?: string;
  } = {},
): Promise<StorePriceMatchProposal | null> {
  const site = await db.query.externalSites.findFirst({
    where: eq(externalSites.id, price.externalSiteId),
  });
  if (site?.type !== SMWS_EXTERNAL_SITE_TYPE) {
    return null;
  }

  const details = parseDetailsFromName(price.name);
  if (!details?.distiller || !details.category) {
    return null;
  }

  const { name } = normalizeBottle({
    name: details.name,
    isFullName: false,
  });
  const brand = await findEntityChoiceByName(SMWS_BRAND_NAME);
  const distiller = await findEntityChoiceByName(details.distiller);
  const existingBottleId = await findTrustedSmwsBottleId(name);
  const existingBottle = existingBottleId
    ? await getBottleMatchCandidateById(existingBottleId)
    : null;

  const extractedLabel: ExtractedBottleDetails = {
    brand: brand?.name ?? SMWS_BRAND_NAME,
    bottler: null,
    expression: name,
    series: null,
    distillery: [distiller?.name ?? details.distiller],
    category: details.category,
    stated_age: null,
    abv: null,
    release_year: null,
    vintage_year: null,
    cask_type: null,
    cask_size: null,
    cask_fill: null,
    cask_strength: null,
    single_cask: true,
    edition: null,
  };
  const candidates = existingBottle ? [existingBottle] : [];
  const decision: StorePriceMatchDecision = existingBottleId
    ? {
        action:
          price.bottleId !== null && price.bottleId !== existingBottleId
            ? "correction"
            : "match_existing",
        confidence: 100,
        rationale: "Deterministic SMWS match from trusted source metadata.",
        suggestedBottleId: existingBottleId,
        suggestedReleaseId: null,
        parentBottleId: null,
        creationTarget: null,
        candidateBottleIds: [existingBottleId],
        proposedBottle: null,
        proposedRelease: null,
      }
    : {
        action: "create_new",
        confidence: 100,
        rationale: "Deterministic SMWS creation from trusted source metadata.",
        suggestedBottleId: null,
        suggestedReleaseId: null,
        parentBottleId: null,
        creationTarget: DEFAULT_PRICE_MATCH_CREATION_TARGET,
        candidateBottleIds: [],
        proposedBottle: {
          name,
          series: null,
          category: details.category,
          edition: null,
          statedAge: null,
          caskStrength: null,
          singleCask: true,
          abv: null,
          vintageYear: null,
          releaseYear: null,
          caskType: null,
          caskSize: null,
          caskFill: null,
          brand: {
            id: brand?.id ?? null,
            name: brand?.name ?? SMWS_BRAND_NAME,
          },
          distillers: [
            {
              id: distiller?.id ?? null,
              name: distiller?.name ?? details.distiller,
            },
          ],
          bottler: {
            id: brand?.id ?? null,
            name: brand?.name ?? SMWS_BRAND_NAME,
          },
        },
        proposedRelease: null,
      };

  const proposal = await upsertStorePriceMatchProposal({
    price,
    extractedLabel,
    candidates,
    decision,
    searchEvidence: [],
    expectedProcessingToken: processingToken,
  });

  if (existingBottleId && price.bottleId === existingBottleId) {
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

    if (existingBottleId) {
      await applyApprovedStorePriceMatch({
        proposalId: proposal.id,
        bottleId: existingBottleId,
        reviewedById: automationUser.id,
        expectedProcessingToken: processingToken,
      });
    } else {
      const createInputs = buildStorePriceMatchCreateInputs(decision);
      if (!createInputs.input && !createInputs.releaseInput) {
        throw new Error(
          `Unable to auto-create trusted SMWS proposal without creation inputs (${proposal.id}).`,
        );
      }

      await createBottleFromStorePriceMatchProposal({
        proposalId: proposal.id,
        ...createInputs,
        user: automationUser,
        expectedProcessingToken: processingToken,
      });
    }

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
      searchEvidence: [],
      error: err instanceof Error ? err.message : "Unknown trusted SMWS error",
      statusOverride: "errored",
      expectedProcessingToken: processingToken,
    });
  }
}

function buildBottleInputFromProposedBottle(
  proposedBottle: ProposedBottleDraft,
): BottleCreateInput {
  return {
    ...proposedBottle,
    series: proposedBottle.series
      ? (proposedBottle.series.id ?? {
          name: proposedBottle.series.name,
          description: null,
        })
      : null,
    brand: buildBottleEntityInput(proposedBottle.brand, "brand"),
    distillers: proposedBottle.distillers.map((distiller) =>
      buildBottleEntityInput(distiller, "distiller"),
    ),
    bottler: proposedBottle.bottler
      ? buildBottleEntityInput(proposedBottle.bottler, "bottler")
      : null,
    description: null,
    descriptionSrc: null,
    imageUrl: null,
    flavorProfile: null,
  };
}

function buildBottleReleaseInputFromProposedRelease(
  proposedRelease: ProposedRelease,
): z.infer<typeof BottleReleaseInputSchema> {
  return {
    ...proposedRelease,
    description: proposedRelease.description ?? null,
    imageUrl: proposedRelease.imageUrl ?? null,
    tastingNotes: proposedRelease.tastingNotes ?? null,
  };
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
  return {
    input: decision.proposedBottle
      ? buildBottleInputFromProposedBottle(decision.proposedBottle)
      : undefined,
    releaseInput: decision.proposedRelease
      ? buildBottleReleaseInputFromProposedRelease(decision.proposedRelease)
      : undefined,
  };
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
    rationale: decision?.rationale ?? null,
    model: config.OPENAI_MODEL,
    error: error || null,
    lastEvaluatedAt: sql`NOW()`,
    reviewedById: null,
    reviewedAt: null,
    updatedAt: sql`NOW()`,
  };
  const [proposal] = await db
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
      set: proposalValues,
    })
    .returning();

  if (!proposal && expectedProcessingToken) {
    return await reloadStorePriceMatchProposalByPriceId(price.id);
  }

  return proposal;
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

  if (creationTarget === "bottle" || creationTarget === "bottle_and_release") {
    if (!input) {
      throw new Error(
        `Missing proposed bottle input for price match proposal (${proposal.id}).`,
      );
    }

    createResult = await createBottleInTransaction(tx, {
      input,
      context: {
        user,
      },
    });
  }

  if (creationTarget === "release" || creationTarget === "bottle_and_release") {
    if (!releaseInput) {
      throw new Error(
        `Missing proposed release input for price match proposal (${proposal.id}).`,
      );
    }

    const releaseBottleId =
      creationTarget === "release"
        ? proposal.parentBottleId
        : (createResult?.bottle.id ?? null);

    if (!releaseBottleId) {
      throw new Error(
        `Missing parent bottle for release creation (${proposal.id}).`,
      );
    }

    createReleaseResult = await createBottleReleaseInTransaction(tx, {
      bottleId: releaseBottleId,
      input: releaseInput,
      user,
    });
  }

  const resolvedBottleId =
    createResult?.bottle.id ??
    createReleaseResult?.release.bottleId ??
    proposal.parentBottleId;

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
      releaseId: createReleaseResult?.release.id ?? null,
      reviewedById: user.id,
    },
  );

  return {
    createResult,
    createReleaseResult,
    aliasResult,
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
    await finalizeCreatedBottle(result.createResult);
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
        where: eq(
          bottles.id,
          result.createReleaseResult?.release.bottleId ??
            result.aliasResult.alias.bottleId!,
        ),
      }))!,
    release: result.createReleaseResult?.release ?? null,
  };
}

export async function resolveStorePriceMatchProposal(
  priceId: number,
  {
    force = false,
    processingToken,
  }: {
    force?: boolean;
    processingToken?: string;
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
    const trustedSmwsProposal = await maybeResolveTrustedSmwsStorePriceMatch(
      price,
      {
        processingToken,
      },
    );
    if (trustedSmwsProposal) {
      return trustedSmwsProposal;
    }

    if (shouldAutoIgnoreTrivialNonWhiskyListing(price.name)) {
      return await upsertStorePriceMatchProposal({
        price,
        extractedLabel,
        candidates,
        searchEvidence,
        statusOverride: "ignored",
        expectedProcessingToken: processingToken,
      });
    }

    // Price matching consumes the generic bottle classifier and only layers
    // price-specific persistence and automation policy on top of its result.
    const classification = await classifyBottleReference({
      reference: {
        id: price.id,
        externalSiteId: price.externalSiteId,
        name: price.name,
        url: price.url ?? null,
        imageUrl: price.imageUrl ?? null,
        currentBottleId: price.bottleId ?? null,
        currentReleaseId: price.releaseId ?? null,
      },
    });

    extractedLabel = classification.artifacts.extractedIdentity;
    candidates = classification.artifacts.candidates;
    searchEvidence = classification.artifacts.searchEvidence;

    if (isIgnoredBottleClassification(classification)) {
      return await upsertStorePriceMatchProposal({
        price,
        extractedLabel,
        candidates,
        searchEvidence,
        statusOverride: "ignored",
        expectedProcessingToken: processingToken,
      });
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

    if (
      !shouldAutoCreateStorePriceMatchProposal({
        decision,
        automationAssessment,
      })
    ) {
      return proposal;
    }

    try {
      const automationUser = await getAutomationModeratorUser();
      const createInputs = buildStorePriceMatchCreateInputs(decision);
      if (!createInputs.input && !createInputs.releaseInput) {
        throw new Error(
          `Unable to auto-create price match proposal without creation inputs (${proposal.id}).`,
        );
      }

      if (
        processingToken &&
        !(await canContinueStorePriceMatchProcessing(
          proposal.id,
          processingToken,
        ))
      ) {
        return await reloadStorePriceMatchProposal(proposal.id);
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
        error: err instanceof Error ? err.message : "Unknown auto-create error",
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
