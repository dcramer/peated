import {
  classifyStorePriceMatch,
  StorePriceMatchClassificationError,
} from "@peated/server/agents/priceMatch";
import config from "@peated/server/config";
import { db, type AnyDatabase, type AnyTransaction } from "@peated/server/db";
import {
  bottles,
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
import {
  normalizeString,
  stripDuplicateBrandPrefixFromBottleName,
} from "@peated/server/lib/normalize";
import {
  extractStorePriceBottleDetails,
  findStorePriceMatchCandidates,
} from "@peated/server/lib/priceMatchingCandidates";
import { getAutomationModeratorUser } from "@peated/server/lib/systemUser";
import type {
  BottleInputSchema,
  ExtractedBottleDetailsSchema,
  PriceMatchCandidateSchema,
  PriceMatchSearchEvidenceSchema,
  StorePriceMatchDecisionSchema,
} from "@peated/server/schemas";
import { eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";

const VERIFIED_MATCH_CONFIDENCE_THRESHOLD = 80;
const AUTO_CREATE_NEW_CONFIDENCE_THRESHOLD = 90;
const NON_WHISKY_KEYWORDS =
  /\b(vodka|gin|rum|tequila|mezcal|sotol|soju|baijiu|sake|shochu|brandy|cognac|armagnac|liqueur)\b/i;
const WHISKY_KEYWORDS =
  /\b(whisk(?:e)?y|single malt|single grain|single pot still|bourbon|rye|scotch|malt whisky|malt whiskey)\b/i;
const REVIEWABLE_STORE_PRICE_MATCH_PROPOSAL_STATUSES = [
  "pending_review",
  "errored",
] as const;
const CLOSED_STORE_PRICE_MATCH_PROPOSAL_STATUSES: readonly StorePriceMatchProposal["status"][] =
  ["approved", "ignored"];

type ExtractedBottleDetails = z.infer<typeof ExtractedBottleDetailsSchema>;
type PriceMatchCandidate = z.infer<typeof PriceMatchCandidateSchema>;
type SearchEvidence = z.infer<typeof PriceMatchSearchEvidenceSchema>;
type StorePriceMatchDecision = z.infer<typeof StorePriceMatchDecisionSchema>;
type StorePriceMatchProposalForReview = StorePriceMatchProposal & {
  price: StorePrice;
};

function normalizeStorePriceMatchConfidence(confidence: number): number {
  const percentageConfidence = confidence <= 1 ? confidence * 100 : confidence;

  return Math.min(100, Math.max(0, Math.round(percentageConfidence)));
}

function sanitizeStorePriceMatchDecision(
  decision: StorePriceMatchDecision,
  {
    candidateBottles,
    searchEvidence,
  }: {
    candidateBottles: PriceMatchCandidate[];
    searchEvidence: SearchEvidence[];
  },
): StorePriceMatchDecision {
  const candidateBottleIds = new Set(
    candidateBottles.map((candidate) => candidate.bottleId),
  );

  if (
    (decision.action === "match_existing" ||
      decision.action === "correction") &&
    decision.suggestedBottleId === null
  ) {
    throw new StorePriceMatchClassificationError(
      `Classifier returned ${decision.action} without a suggested bottle id.`,
      searchEvidence,
      candidateBottles,
    );
  }

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

  if (decision.action === "create_new" && !decision.proposedBottle) {
    throw new StorePriceMatchClassificationError(
      "Classifier returned create_new without a proposed bottle.",
      searchEvidence,
      candidateBottles,
    );
  }

  const hasConcreteWhiskyCategory =
    decision.action !== "create_new" ||
    (decision.proposedBottle?.category !== null &&
      decision.proposedBottle?.category !== "spirit");
  const normalizedConfidence = normalizeStorePriceMatchConfidence(
    decision.confidence,
  );
  const boundedConfidence =
    decision.action === "create_new" &&
    (searchEvidence.length === 0 || !hasConcreteWhiskyCategory)
      ? Math.min(normalizedConfidence, AUTO_CREATE_NEW_CONFIDENCE_THRESHOLD - 1)
      : normalizedConfidence;

  return {
    ...decision,
    confidence: boundedConfidence,
    suggestedBottleId:
      decision.action === "create_new" ? null : decision.suggestedBottleId,
    candidateBottleIds: decision.candidateBottleIds.filter((id) =>
      candidateBottleIds.has(id),
    ),
    proposedBottle: decision.proposedBottle
      ? {
          ...decision.proposedBottle,
          name: stripDuplicateBrandPrefixFromBottleName(
            decision.proposedBottle.name,
            decision.proposedBottle.brand.name,
          ),
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
          brand: {
            ...decision.proposedBottle.brand,
            id: null,
          },
          distillers: decision.proposedBottle.distillers.map((distiller) => ({
            ...distiller,
            id: null,
          })),
          bottler: decision.proposedBottle.bottler
            ? {
                ...decision.proposedBottle.bottler,
                id: null,
              }
            : null,
        }
      : null,
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
  return (
    decision.action === "create_new" &&
    decision.proposedBottle !== null &&
    decision.confidence >= AUTO_CREATE_NEW_CONFIDENCE_THRESHOLD &&
    searchEvidence.length > 0
  );
}

function buildBottleInputFromProposedBottle(
  proposedBottle: NonNullable<StorePriceMatchDecision["proposedBottle"]>,
): z.infer<typeof BottleInputSchema> {
  return {
    ...proposedBottle,
    series: proposedBottle.series
      ? (proposedBottle.series.id ?? {
          name: proposedBottle.series.name,
          description: null,
        })
      : null,
    brand: proposedBottle.brand.id ?? {
      name: proposedBottle.brand.name,
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
    distillers: proposedBottle.distillers.map(
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
    bottler: proposedBottle.bottler
      ? (proposedBottle.bottler.id ?? {
          name: proposedBottle.bottler.name,
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
}: {
  price: StorePrice;
  extractedLabel: ExtractedBottleDetails | null;
  candidates: PriceMatchCandidate[];
  decision?: StorePriceMatchDecision | null;
  searchEvidence?: SearchEvidence[];
  error?: string | null;
  statusOverride?: StorePriceMatchProposal["status"] | null;
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

  return proposal;
}

async function createBottleFromStorePriceMatchProposalInTransaction(
  tx: AnyTransaction,
  {
    proposalId,
    input,
    user,
  }: {
    proposalId: number;
    input: z.infer<typeof BottleInputSchema>;
    user: User;
  },
) {
  const proposal = await getStorePriceMatchProposalForReviewInTransaction(tx, {
    proposalId,
    expectedProposalType: "create_new",
    allowedStatuses: ["pending_review"],
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
}: {
  proposalId: number;
  input: z.infer<typeof BottleInputSchema>;
  user: User;
}) {
  const result = await db.transaction(async (tx) =>
    createBottleFromStorePriceMatchProposalInTransaction(tx, {
      proposalId,
      input,
      user,
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
  }: {
    force?: boolean;
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

  let extractedLabel: ExtractedBottleDetails | null = null;
  let candidates: PriceMatchCandidate[] = [];
  let searchEvidence: SearchEvidence[] = [];

  try {
    extractedLabel = await extractStorePriceBottleDetails(price);
    if (shouldAutoIgnoreStorePriceListing(price.name, extractedLabel)) {
      return await upsertStorePriceMatchProposal({
        price,
        extractedLabel,
        candidates: [],
        searchEvidence: [],
        statusOverride: "ignored",
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
    });
    const proposal = await upsertStorePriceMatchProposal({
      price,
      extractedLabel,
      candidates,
      decision,
      searchEvidence,
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
      await createBottleFromStorePriceMatchProposal({
        proposalId: proposal.id,
        input: buildBottleInputFromProposedBottle(proposedBottle),
        user: automationUser,
      });

      const autoCreatedProposal =
        await db.query.storePriceMatchProposals.findFirst({
          where: eq(storePriceMatchProposals.id, proposal.id),
        });

      if (!autoCreatedProposal) {
        throw new Error(
          `Unable to reload auto-created price match proposal (${proposal.id}).`,
        );
      }

      return autoCreatedProposal;
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
    });
  }
}

export async function getStorePriceMatchProposalForReviewInTransaction(
  tx: AnyDatabase,
  {
    proposalId,
    expectedProposalType,
    allowedStatuses = REVIEWABLE_STORE_PRICE_MATCH_PROPOSAL_STATUSES,
  }: {
    proposalId: number;
    expectedProposalType?: StorePriceMatchProposal["proposalType"];
    allowedStatuses?: readonly StorePriceMatchProposal["status"][];
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
  await tx.execute(sql`
    UPDATE ${storePriceMatchProposals}
    SET
      status = 'approved',
      current_bottle_id = ${bottleId},
      suggested_bottle_id = ${bottleId},
      proposal_type = CASE
        WHEN ${storePriceMatchProposals.id} = ${proposalId}
          THEN ${storePriceMatchProposals.proposalType}
        ELSE 'match_existing'::store_price_match_proposal_type
      END,
      reviewed_by_id = ${reviewedById},
      reviewed_at = NOW(),
      updated_at = NOW(),
      error = NULL
    FROM ${storePrices}
    WHERE ${storePrices.id} = ${storePriceMatchProposals.priceId}
      AND LOWER(${storePrices.name}) = LOWER(${name})
      AND ${storePriceMatchProposals.status} IN ('pending_review', 'errored')
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
  }: {
    proposalId: number;
    bottleId: number;
    reviewedById: number;
  },
) {
  const proposal = await getStorePriceMatchProposalForReviewInTransaction(tx, {
    proposalId,
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
}: {
  proposalId: number;
  bottleId: number;
  reviewedById: number;
}) {
  const aliasResult = await db.transaction(async (tx) =>
    applyApprovedStorePriceMatchInTransaction(tx, {
      proposalId,
      bottleId,
      reviewedById,
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
