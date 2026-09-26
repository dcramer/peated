import type { StorePriceMatchProposal } from "@peated/server/db/schema";

export const REVIEWABLE_STORE_PRICE_MATCH_PROPOSAL_STATUSES = [
  "pending_review",
  "errored",
] as const satisfies ReadonlyArray<StorePriceMatchProposal["status"]>;

export const CLOSED_STORE_PRICE_MATCH_PROPOSAL_STATUSES = [
  "approved",
  "ignored",
] as const satisfies ReadonlyArray<StorePriceMatchProposal["status"]>;

export function isReviewableStorePriceMatchProposalStatus(
  status: StorePriceMatchProposal["status"],
): status is (typeof REVIEWABLE_STORE_PRICE_MATCH_PROPOSAL_STATUSES)[number] {
  return status === "pending_review" || status === "errored";
}

type StoredProposalType = StorePriceMatchProposal["proposalType"];
export type ProposalType = Exclude<
  StoredProposalType,
  "match_existing" | "create_new" | "correction"
>;

/**
 * Rows written by the previous release during a deploy can still hold the old
 * names, so reads translate them.
 * TODO(prices): Remove with the old enum values in the follow-up deploy.
 */
export function toCurrentProposalType(type: StoredProposalType): ProposalType {
  if (type === "match_existing" || type === "correction") return "match";
  if (type === "create_new") return "create_bottle";
  return type;
}
