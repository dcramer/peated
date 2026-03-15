import {
  classifyStorePriceMatch,
  StorePriceMatchClassificationError,
  type StorePriceMatchClassification,
} from "@peated/server/agents/priceMatch";
import config from "@peated/server/config";
import { db, type AnyDatabase, type AnyTransaction } from "@peated/server/db";
import {
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
import { logError } from "@peated/server/lib/log";
import { normalizeBottle, normalizeString } from "@peated/server/lib/normalize";
import {
  extractStorePriceBottleDetails,
  findStorePriceMatchCandidates,
  getBottleMatchCandidateById,
} from "@peated/server/lib/priceMatchingCandidates";
import { normalizeProposedBottleDraft } from "@peated/server/lib/priceMatchingDraftNormalization";
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
  ExtractedBottleDetailsSchema,
  PriceMatchCandidateSchema,
  PriceMatchSearchEvidenceSchema,
  StorePriceMatchDecisionSchema,
} from "@peated/server/schemas";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";

const VERIFIED_MATCH_CONFIDENCE_THRESHOLD = 80;
const AUTO_CREATE_NEW_CONFIDENCE_THRESHOLD = 90;
const SMWS_EXTERNAL_SITE_TYPE = "smws";
const SMWS_BRAND_NAME = "The Scotch Malt Whisky Society";
const NON_WHISKY_KEYWORDS =
  /\b(vodka|gin|rum|tequila|mezcal|sotol|soju|baijiu|sake|shochu|brandy|cognac|armagnac|liqueur)\b/i;
const WHISKY_KEYWORDS =
  /\b(whisk(?:e)?y|single malt|single grain|single pot still|bourbon|rye|scotch|malt whisky|malt whiskey)\b/i;

type ExtractedBottleDetails = z.infer<typeof ExtractedBottleDetailsSchema>;
type PriceMatchCandidate = z.infer<typeof PriceMatchCandidateSchema>;
type SearchEvidence = z.infer<typeof PriceMatchSearchEvidenceSchema>;
type StorePriceMatchDecision = z.infer<typeof StorePriceMatchDecisionSchema>;
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

  const hasConcreteWhiskyCategory =
    decision.action !== "create_new" ||
    (decision.proposedBottle?.category !== null &&
      decision.proposedBottle?.category !== "spirit");
  const hasCorroboratingSearchEvidence = searchEvidence.some(
    (evidence) => evidence.results.length > 0,
  );
  const normalizedConfidence = normalizeStorePriceMatchConfidence(
    decision.confidence,
  );
  const boundedConfidence =
    decision.action === "create_new" &&
    (!hasCorroboratingSearchEvidence || !hasConcreteWhiskyCategory)
      ? Math.min(normalizedConfidence, AUTO_CREATE_NEW_CONFIDENCE_THRESHOLD - 1)
      : normalizedConfidence;

  const filteredCandidateBottleIds = decision.candidateBottleIds.filter((id) =>
    candidateBottleIds.has(id),
  );

  if (decision.action === "create_new") {
    const brand = sanitizeResolvedEntityChoice(
      decision.proposedBottle.brand,
      "brand",
      resolvedEntitiesById,
    );
    const distillers = decision.proposedBottle.distillers.map((distiller) =>
      sanitizeResolvedEntityChoice(
        distiller,
        "distiller",
        resolvedEntitiesById,
      ),
    );
    const bottler = decision.proposedBottle.bottler
      ? sanitizeResolvedEntityChoice(
          decision.proposedBottle.bottler,
          "bottler",
          resolvedEntitiesById,
        )
      : null;

    return {
      ...decision,
      confidence: boundedConfidence,
      suggestedBottleId: null,
      candidateBottleIds: filteredCandidateBottleIds,
      proposedBottle: normalizeProposedBottleDraft({
        ...decision.proposedBottle,
        category:
          decision.proposedBottle.category === "spirit"
            ? null
            : decision.proposedBottle.category,
        series: decision.proposedBottle.series
          ? {
              ...decision.proposedBottle.series,
              id: null,
            }
          : null,
        brand,
        distillers,
        bottler,
      }),
    };
  }

  if (
    decision.action === "match_existing" ||
    decision.action === "correction"
  ) {
    return {
      ...decision,
      confidence: boundedConfidence,
      candidateBottleIds: filteredCandidateBottleIds,
      proposedBottle: null,
    };
  }

  return {
    ...decision,
    confidence: boundedConfidence,
    suggestedBottleId: null,
    candidateBottleIds: filteredCandidateBottleIds,
    proposedBottle: null,
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
      decision.suggestedBottleId === price.bottleId
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
): StorePriceMatchProposal["status"] {
  if (
    price.bottleId &&
    decision.action === "match_existing" &&
    decision.suggestedBottleId === price.bottleId &&
    decision.confidence >= VERIFIED_MATCH_CONFIDENCE_THRESHOLD
  ) {
    return "verified";
  }
  return "pending_review";
}

function shouldAutoCreateStorePriceMatchProposal({
  decision,
  searchEvidence,
}: {
  decision: StorePriceMatchDecision;
  searchEvidence: SearchEvidence[];
}) {
  const hasCorroboratingSearchEvidence = searchEvidence.some(
    (evidence) => evidence.results.length > 0,
  );

  return (
    decision.action === "create_new" &&
    decision.proposedBottle !== null &&
    decision.confidence >= AUTO_CREATE_NEW_CONFIDENCE_THRESHOLD &&
    hasCorroboratingSearchEvidence
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
    expression: name,
    series: null,
    distillery: [distiller?.name ?? details.distiller],
    category: details.category,
    stated_age: null,
    abv: null,
    release_year: null,
    vintage_year: null,
    cask_type: null,
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
        candidateBottleIds: [existingBottleId],
        proposedBottle: null,
      }
    : {
        action: "create_new",
        confidence: 100,
        rationale: "Deterministic SMWS creation from trusted source metadata.",
        suggestedBottleId: null,
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
      const proposedBottle =
        decision.action === "create_new" ? decision.proposedBottle : null;
      if (!proposedBottle) {
        throw new Error(
          `Unable to auto-create trusted SMWS proposal without a proposed bottle (${proposal.id}).`,
        );
      }

      await createBottleFromStorePriceMatchProposal({
        proposalId: proposal.id,
        input: buildBottleInputFromProposedBottle(proposedBottle),
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
  proposedBottle: NonNullable<StorePriceMatchDecision["proposedBottle"]>,
): z.infer<typeof BottleInputSchema> {
  const normalizedProposedBottle = normalizeProposedBottleDraft(proposedBottle);

  return {
    ...normalizedProposedBottle,
    series: normalizedProposedBottle.series
      ? (normalizedProposedBottle.series.id ?? {
          name: normalizedProposedBottle.series.name,
          description: null,
        })
      : null,
    brand: normalizedProposedBottle.brand.id ?? {
      name: normalizedProposedBottle.brand.name,
      type: ["brand"],
      description: null,
      shortName: null,
      location: null,
      address: null,
      yearEstablished: null,
      website: null,
      country: null,
      region: null,
    },
    distillers: normalizedProposedBottle.distillers.map(
      (distiller) =>
        distiller.id ?? {
          name: distiller.name,
          type: ["distiller"],
          description: null,
          shortName: null,
          location: null,
          address: null,
          yearEstablished: null,
          website: null,
          country: null,
          region: null,
        },
    ),
    bottler: normalizedProposedBottle.bottler
      ? (normalizedProposedBottle.bottler.id ?? {
          name: normalizedProposedBottle.bottler.name,
          type: ["bottler"],
          description: null,
          shortName: null,
          location: null,
          address: null,
          yearEstablished: null,
          website: null,
          country: null,
          region: null,
        })
      : null,
    description: null,
    descriptionSrc: null,
    imageUrl: null,
    flavorProfile: null,
  };
}

export async function upsertStorePriceMatchProposal({
  price,
  extractedLabel,
  candidates,
  decision,
  searchEvidence,
  error,
  statusOverride,
  expectedProcessingToken,
}: {
  price: StorePrice;
  extractedLabel: ExtractedBottleDetails | null;
  candidates: PriceMatchCandidate[];
  decision?: StorePriceMatchDecision | null;
  searchEvidence?: SearchEvidence[];
  error?: string | null;
  statusOverride?: StorePriceMatchProposal["status"] | null;
  expectedProcessingToken?: string;
}) {
  const proposalType = decision ? getProposalType(price, decision) : "no_match";
  const status =
    statusOverride ??
    (decision ? getProposalStatus(price, decision) : "errored");
  const [proposal] = await db
    .insert(storePriceMatchProposals)
    .values({
      priceId: price.id,
      status,
      proposalType,
      confidence: decision?.confidence ?? null,
      currentBottleId: price.bottleId,
      suggestedBottleId: decision?.suggestedBottleId ?? null,
      candidateBottles: candidates,
      extractedLabel,
      proposedBottle: decision?.proposedBottle ?? null,
      searchEvidence: searchEvidence || [],
      rationale: decision?.rationale ?? null,
      model: config.OPENAI_MODEL,
      error: error || null,
      lastEvaluatedAt: sql`NOW()`,
      reviewedById: null,
      reviewedAt: null,
      updatedAt: sql`NOW()`,
    })
    .onConflictDoUpdate({
      target: storePriceMatchProposals.priceId,
      setWhere: expectedProcessingToken
        ? sql`${storePriceMatchProposals.processingToken} = ${expectedProcessingToken} AND ${storePriceMatchProposals.processingExpiresAt} IS NOT NULL AND ${storePriceMatchProposals.processingExpiresAt} > NOW()`
        : undefined,
      set: {
        status,
        proposalType,
        confidence: decision?.confidence ?? null,
        currentBottleId: price.bottleId,
        suggestedBottleId: decision?.suggestedBottleId ?? null,
        candidateBottles: candidates,
        extractedLabel,
        proposedBottle: decision?.proposedBottle ?? null,
        searchEvidence: searchEvidence || [],
        rationale: decision?.rationale ?? null,
        model: config.OPENAI_MODEL,
        error: error || null,
        lastEvaluatedAt: sql`NOW()`,
        reviewedById: null,
        reviewedAt: null,
        updatedAt: sql`NOW()`,
      },
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
    user,
    expectedProcessingToken,
  }: {
    proposalId: number;
    input: z.infer<typeof BottleInputSchema>;
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
  const createResult = await createBottleInTransaction(tx, {
    input,
    context: {
      user,
    },
  });
  const aliasResult = await applyApprovedStorePriceMatchProposalInTransaction(
    tx,
    {
      proposal,
      bottleId: createResult.bottle.id,
      reviewedById: user.id,
    },
  );

  return {
    createResult,
    aliasResult,
  };
}

export async function createBottleFromStorePriceMatchProposal({
  proposalId,
  input,
  user,
  expectedProcessingToken,
}: {
  proposalId: number;
  input: z.infer<typeof BottleInputSchema>;
  user: User;
  expectedProcessingToken?: string;
}) {
  const result = await db.transaction(async (tx) =>
    createBottleFromStorePriceMatchProposalInTransaction(tx, {
      proposalId,
      input,
      user,
      expectedProcessingToken,
    }),
  );

  await finalizeCreatedBottle(result.createResult);
  await finalizeBottleAliasAssignment(result.aliasResult, {
    bottle: {
      id: result.createResult.bottle.id,
    },
  });

  return result.createResult.bottle;
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
    const proposal = await upsertStorePriceMatchProposal({
      price,
      extractedLabel,
      candidates,
      decision,
      searchEvidence,
      expectedProcessingToken: processingToken,
    });

    if (
      !shouldAutoCreateStorePriceMatchProposal({ decision, searchEvidence })
    ) {
      return proposal;
    }

    try {
      const automationUser = await getAutomationModeratorUser();
      const proposedBottle = decision.proposedBottle;
      if (!proposedBottle) {
        throw new Error(
          `Unable to auto-create price match proposal without a proposed bottle (${proposal.id}).`,
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
        input: buildBottleInputFromProposedBottle(proposedBottle),
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
    name,
    bottleId,
    reviewedById,
  }: {
    proposalId: number;
    name: string;
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

  await tx.execute(sql`
    UPDATE ${storePriceMatchProposals}
    SET
      status = 'approved',
      current_bottle_id = ${bottleId},
      suggested_bottle_id = ${bottleId},
      processing_token = NULL,
      processing_queued_at = NULL,
      processing_expires_at = NULL,
      proposal_type = 'match_existing'::store_price_match_proposal_type,
      reviewed_by_id = ${reviewedById},
      reviewed_at = NOW(),
      updated_at = NOW(),
      error = NULL
    FROM ${storePrices}
    WHERE ${storePrices.id} = ${storePriceMatchProposals.priceId}
      AND ${storePriceMatchProposals.id} <> ${proposalId}
      AND LOWER(${storePrices.name}) = LOWER(${name})
      AND ${storePriceMatchProposals.status} IN ('pending_review', 'errored')
      AND (${storePriceMatchProposals.processingExpiresAt} IS NULL OR ${storePriceMatchProposals.processingExpiresAt} <= NOW())
  `);
}

export async function applyApprovedStorePriceMatchProposalInTransaction(
  tx: AnyDatabase,
  {
    proposal,
    bottleId,
    reviewedById,
  }: {
    proposal: StorePriceMatchProposalForReview;
    bottleId: number;
    reviewedById: number;
  },
) {
  const aliasResult = await assignBottleAliasInTransaction(tx, {
    bottleId,
    name: proposal.price.name,
  });

  await markApprovedStorePriceMatchProposalsInTransaction(tx, {
    proposalId: proposal.id,
    name: proposal.price.name,
    bottleId,
    reviewedById,
  });

  return aliasResult;
}

export async function applyApprovedStorePriceMatchInTransaction(
  tx: AnyDatabase,
  {
    proposalId,
    bottleId,
    reviewedById,
    expectedProcessingToken,
  }: {
    proposalId: number;
    bottleId: number;
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
    reviewedById,
  });
}

export async function applyApprovedStorePriceMatch({
  proposalId,
  bottleId,
  reviewedById,
  expectedProcessingToken,
}: {
  proposalId: number;
  bottleId: number;
  reviewedById: number;
  expectedProcessingToken?: string;
}) {
  const aliasResult = await db.transaction(async (tx) =>
    applyApprovedStorePriceMatchInTransaction(tx, {
      proposalId,
      bottleId,
      reviewedById,
      expectedProcessingToken,
    }),
  );

  await finalizeBottleAliasAssignment(aliasResult, {
    bottle: {
      id: bottleId,
    },
  });
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

export async function getProposalBottles(
  proposalList: Pick<
    StorePriceMatchProposal,
    "currentBottleId" | "suggestedBottleId"
  >[],
) {
  const bottleIds = Array.from(
    new Set(
      proposalList.flatMap((proposal) =>
        [proposal.currentBottleId, proposal.suggestedBottleId].filter(
          (id): id is number => !!id,
        ),
      ),
    ),
  );

  if (!bottleIds.length) {
    return [];
  }

  return await db.query.bottles.findMany({
    where: inArray(bottles.id, bottleIds),
    with: {
      brand: true,
      bottler: true,
      series: true,
    },
  });
}
