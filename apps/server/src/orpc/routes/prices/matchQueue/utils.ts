import {
  type ExternalSite,
  type StorePrice,
  type StorePriceMatchProposal,
} from "@peated/server/db/schema";
import { type Context } from "@peated/server/orpc/context";
import {
  StorePriceMatchProposalSchema,
  StorePriceMatchQueueItemSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { StorePriceWithSiteSerializer } from "@peated/server/serializers/storePrice";

type QueueRow = {
  proposal: StorePriceMatchProposal;
  price: StorePrice & { externalSite: ExternalSite };
};

export async function serializeQueueItems(
  rows: QueueRow[],
  bottleList: any[],
  context: Context,
) {
  const bottlesById = Object.fromEntries(
    (
      await serialize(BottleSerializer, bottleList, context.user, [
        "description",
        "tastingNotes",
      ])
    ).map((item, index) => [bottleList[index].id, item]),
  );

  const prices = await serialize(
    StorePriceWithSiteSerializer,
    rows.map((row) => row.price),
    context.user,
  );

  return rows.map((row, index) =>
    StorePriceMatchQueueItemSchema.parse({
      ...serializeProposal(row.proposal),
      price: prices[index],
      currentBottle: row.proposal.currentBottleId
        ? (bottlesById[row.proposal.currentBottleId] ?? null)
        : null,
      suggestedBottle: row.proposal.suggestedBottleId
        ? (bottlesById[row.proposal.suggestedBottleId] ?? null)
        : null,
    }),
  );
}

export function serializeProposal(proposal: StorePriceMatchProposal) {
  return StorePriceMatchProposalSchema.parse({
    id: proposal.id,
    status: proposal.status,
    proposalType: proposal.proposalType,
    confidence: proposal.confidence,
    currentBottleId: proposal.currentBottleId,
    suggestedBottleId: proposal.suggestedBottleId,
    candidateBottles: proposal.candidateBottles,
    extractedLabel: proposal.extractedLabel ?? null,
    proposedBottle: proposal.proposedBottle ?? null,
    searchEvidence: proposal.searchEvidence,
    rationale: proposal.rationale,
    model: proposal.model,
    error: proposal.error,
    lastEvaluatedAt: proposal.lastEvaluatedAt
      ? proposal.lastEvaluatedAt.toISOString()
      : null,
    reviewedAt: proposal.reviewedAt ? proposal.reviewedAt.toISOString() : null,
    createdAt: proposal.createdAt.toISOString(),
    updatedAt: proposal.updatedAt.toISOString(),
  });
}
