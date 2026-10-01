import type { AnyTransaction } from "@peated/server/db";
import {
  storePriceMatchProposals,
  type StorePriceMatchProposal,
} from "@peated/server/db/schema";
import { inArray, sql } from "drizzle-orm";

/** Keep the previous proposal as evidence, not as the next suggestion. */
export function priceMatchProposalHistory(proposal: StorePriceMatchProposal) {
  return {
    proposalId: proposal.id,
    status: proposal.status,
    bottleId: proposal.currentBottleId,
    suggestedBottleId: proposal.suggestedBottleId,
    proposalType: proposal.proposalType,
    referenceScope: proposal.referenceScope,
    rationale: proposal.rationale,
    proposedBottle: proposal.proposedBottle,
    automationAssessment: proposal.automationAssessment,
    reviewedById: proposal.reviewedById,
    reviewedAt: proposal.reviewedAt?.toISOString() ?? null,
  };
}

/** Invalidated matches return to review without repeating the old automated approval. */
export async function reopenStorePriceMatchesInTransaction(
  tx: AnyTransaction,
  priceIds: number[],
) {
  if (!priceIds.length) return [];
  const previous = await tx
    .select()
    .from(storePriceMatchProposals)
    .where(inArray(storePriceMatchProposals.priceId, priceIds))
    .for("update");
  await tx
    .update(storePriceMatchProposals)
    .set({
      status: "pending_review",
      proposalType: "no_match",
      currentBottleId: null,
      suggestedBottleId: null,
      referenceScope: "none",
      automationAssessment: null,
      confidence: null,
      proposedBottle: null,
      rationale:
        "The previous match was invalidated. Review the source before assigning a Bottle.",
      error: null,
      processingToken: null,
      processingQueuedAt: null,
      processingExpiresAt: null,
      reviewedById: null,
      reviewedAt: null,
      enteredQueueAt: sql`NOW()`,
      updatedAt: sql`NOW()`,
    })
    .where(inArray(storePriceMatchProposals.priceId, priceIds));
  return previous;
}
