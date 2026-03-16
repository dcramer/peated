import {
  classifyStorePriceMatch,
  StorePriceMatchClassificationError,
  type StorePriceMatchClassification,
} from "@peated/server/agents/priceMatch";
import config from "@peated/server/config";
import { db, type AnyDatabase, type AnyTransaction } from "@peated/server/db";
import {
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
import { upsertBottleObservationInTransaction } from "@peated/server/lib/bottleObservations";
import {
  DEFAULT_PRICE_MATCH_CREATION_TARGET,
  getReleaseObservationFacts,
} from "@peated/server/lib/bottleSchemaRules";
import {
  createBottleInTransaction,
  finalizeCreatedBottle,
} from "@peated/server/lib/createBottle";
import {
  createBottleReleaseInTransaction,
  finalizeCreatedBottleRelease,
} from "@peated/server/lib/createBottleRelease";
import { logError } from "@peated/server/lib/log";
import { normalizeBottle, normalizeString } from "@peated/server/lib/normalize";
import {
  getStorePriceMatchAutomationAssessment,
  shouldVerifyStorePriceMatch,
  type StorePriceMatchAutomationAssessment,
} from "@peated/server/lib/priceMatchingAutomation";
import {
  extractStorePriceBottleDetails,
  findStorePriceMatchCandidates,
  getBottleMatchCandidateById,
} from "@peated/server/lib/priceMatchingCandidates";
import {
  inferPriceMatchCreationTarget,
  normalizeCreateNewDrafts,
} from "@peated/server/lib/priceMatchingDraftNormalization";
import {
  hasActiveStorePriceMatchProposalProcessingLease,
  refreshStorePriceMatchProposalProcessingLease,
  releaseStorePriceMatchProposalProcessingLease,
} from "@peated/server/lib/priceMatchingProcessingLease";
import {
  CLOSED_STORE_PRICE_MATCH_PROPOSAL_STATUSES,
  REVIEWABLE_STORE_PRICE_MATCH_PROPOSAL_STATUSES,
} from "@peated/server/lib/priceMatchingStatus";
import { parseDetailsFromName } from "@peated/server/lib/smws";
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
const NON_WHISKY_KEYWORDS =
  /\b(vodka|gin|rum|tequila|mezcal|sotol|soju|baijiu|sake|shochu|brandy|cognac|armagnac|liqueur)\b/i;
const WHISKY_KEYWORDS =
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
type ResolvedEntity = NonNullable<
  StorePriceMatchClassification["resolvedEntities"]
>[number];
type StorePriceMatchProposalForReview = StorePriceMatchProposal & {
  price: StorePrice;
};

function normalizeStorePriceMatchConfidence(confidence: number): number {
  const percentageConfidence = confidence <= 1 ? confidence * 100 : confidence;

  return Math.min(100, Math.max(0, Math.round(percentageConfidence)));
}

function normalizeEntityChoiceName(name: string) {
  return normalizeString(name).toLowerCase();
}

function sanitizeResolvedEntityChoice(
  choice: {
    id: number | null;
    name: string;
  },
  expectedType: "brand" | "distiller" | "bottler",
  resolvedEntities: Map<number, ResolvedEntity>,
) {
  if (choice.id === null) {
    return choice;
  }

  const resolvedEntity = resolvedEntities.get(choice.id);
  if (!resolvedEntity || !resolvedEntity.type.includes(expectedType)) {
    return {
      ...choice,
      id: null,
    };
  }

  const normalizedChoiceName = normalizeEntityChoiceName(choice.name);
  const matchedNames = [
    resolvedEntity.name,
    resolvedEntity.shortName,
    resolvedEntity.alias,
  ]
    .filter((name): name is string => !!name)
    .map(normalizeEntityChoiceName);

  if (!matchedNames.includes(normalizedChoiceName)) {
    return {
      ...choice,
      id: null,
    };
  }

  return {
    id: resolvedEntity.entityId,
    name: resolvedEntity.name,
  };
}

function sanitizeProposedBottleDraft(
  proposedBottle: NonNullable<StorePriceMatchDecision["proposedBottle"]>,
  resolvedEntitiesById: Map<number, ResolvedEntity>,
) {
  return {
    ...proposedBottle,
    category:
      proposedBottle.category === "spirit" ? null : proposedBottle.category,
    series: proposedBottle.series
      ? {
          ...proposedBottle.series,
          id: null,
        }
      : null,
    brand: sanitizeResolvedEntityChoice(
      proposedBottle.brand,
      "brand",
      resolvedEntitiesById,
    ),
    distillers: proposedBottle.distillers.map((distiller) =>
      sanitizeResolvedEntityChoice(
        distiller,
        "distiller",
        resolvedEntitiesById,
      ),
    ),
    bottler: proposedBottle.bottler
      ? sanitizeResolvedEntityChoice(
          proposedBottle.bottler,
          "bottler",
          resolvedEntitiesById,
        )
      : null,
  };
}

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

function sanitizeStorePriceMatchDecision(
  decision: StorePriceMatchDecision,
  {
    candidateBottles,
    searchEvidence,
    resolvedEntities = [],
  }: {
    candidateBottles: PriceMatchCandidate[];
    searchEvidence: SearchEvidence[];
    resolvedEntities?: ResolvedEntity[];
  },
): StorePriceMatchDecision {
  const candidateBottleIds = new Set(
    candidateBottles.map((candidate) => candidate.bottleId),
  );
  const candidateReleaseIds = new Set(
    candidateBottles
      .map((candidate) => candidate.releaseId)
      .filter((releaseId): releaseId is number => releaseId !== null),
  );
  const resolvedEntitiesById = new Map(
    resolvedEntities.map((entity) => [entity.entityId, entity]),
  );

  if (
    decision.suggestedBottleId !== null &&
    !candidateBottleIds.has(decision.suggestedBottleId)
  ) {
    throw new StorePriceMatchClassificationError(
      `Classifier returned unknown suggested bottle id (${decision.suggestedBottleId}).`,
      searchEvidence,
      candidateBottles,
    );
  }

  if (
    decision.suggestedReleaseId != null &&
    !candidateReleaseIds.has(decision.suggestedReleaseId)
  ) {
    throw new StorePriceMatchClassificationError(
      `Classifier returned unknown suggested release id (${decision.suggestedReleaseId}).`,
      searchEvidence,
      candidateBottles,
    );
  }

  if (
    decision.action === "create_new" &&
    decision.parentBottleId !== null &&
    decision.parentBottleId !== undefined &&
    !candidateBottleIds.has(decision.parentBottleId)
  ) {
    throw new StorePriceMatchClassificationError(
      `Classifier returned unknown parent bottle id (${decision.parentBottleId}).`,
      searchEvidence,
      candidateBottles,
    );
  }

  const normalizedConfidence = normalizeStorePriceMatchConfidence(
    decision.confidence,
  );

  const filteredCandidateBottleIds = decision.candidateBottleIds.filter((id) =>
    candidateBottleIds.has(id),
  );

  if (decision.action === "create_new") {
    const sanitizedBottleDraft = decision.proposedBottle
      ? sanitizeProposedBottleDraft(
          decision.proposedBottle,
          resolvedEntitiesById,
        )
      : null;

    const normalizedDrafts = normalizeCreateNewDrafts({
      creationTarget: decision.creationTarget ?? null,
      proposedBottle: sanitizedBottleDraft,
      proposedRelease: decision.proposedRelease ?? null,
    });

    return {
      ...decision,
      confidence: normalizedConfidence,
      suggestedBottleId: null,
      suggestedReleaseId: null,
      creationTarget: normalizedDrafts.creationTarget,
      candidateBottleIds: filteredCandidateBottleIds,
      proposedBottle: normalizedDrafts.proposedBottle,
      proposedRelease: normalizedDrafts.proposedRelease,
    };
  }

  if (
    decision.action === "match_existing" ||
    decision.action === "correction"
  ) {
    return {
      ...decision,
      confidence: normalizedConfidence,
      candidateBottleIds: filteredCandidateBottleIds,
      proposedBottle: null,
      proposedRelease: null,
      parentBottleId: null,
      creationTarget: null,
    };
  }

  return {
    ...decision,
    confidence: normalizedConfidence,
    suggestedBottleId: null,
    suggestedReleaseId: null,
    parentBottleId: null,
    creationTarget: null,
    candidateBottleIds: filteredCandidateBottleIds,
    proposedBottle: null,
    proposedRelease: null,
  };
}

function shouldAutoIgnoreStorePriceListing(
  priceName: string,
  extractedLabel: ExtractedBottleDetails | null,
) {
  if (extractedLabel) {
    return false;
  }

  const normalizedName = normalizeString(priceName).toLowerCase();
  return (
    NON_WHISKY_KEYWORDS.test(normalizedName) &&
    !WHISKY_KEYWORDS.test(normalizedName)
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

  const normalizedDecision = sanitizeStorePriceMatchDecision(decision, {
    candidateBottles: candidates,
    searchEvidence: [],
    resolvedEntities: [],
  });

  const proposal = await upsertStorePriceMatchProposal({
    price,
    extractedLabel,
    candidates,
    decision: normalizedDecision,
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
      const createInputs = buildStorePriceMatchCreateInputs(normalizedDecision);
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
      decision: normalizedDecision,
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
  return await upsertBottleObservationInTransaction(tx, {
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
  });
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

  const creationTarget = inferPriceMatchCreationTarget({
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

    extractedLabel = await extractStorePriceBottleDetails(price);
    if (shouldAutoIgnoreStorePriceListing(price.name, extractedLabel)) {
      return await upsertStorePriceMatchProposal({
        price,
        extractedLabel,
        candidates: [],
        searchEvidence: [],
        statusOverride: "ignored",
        expectedProcessingToken: processingToken,
      });
    }

    candidates = await findStorePriceMatchCandidates(price, extractedLabel);
    const classification = await classifyStorePriceMatch({
      price,
      extractedLabel,
      initialCandidates: candidates,
    });
    candidates = classification.candidateBottles;
    searchEvidence = classification.searchEvidence;
    const decision = sanitizeStorePriceMatchDecision(classification.decision, {
      candidateBottles: candidates,
      searchEvidence,
      resolvedEntities: classification.resolvedEntities,
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
      extractedLabel,
      candidates:
        err instanceof StorePriceMatchClassificationError
          ? err.candidateBottles
          : candidates,
      searchEvidence:
        err instanceof StorePriceMatchClassificationError
          ? err.searchEvidence
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
