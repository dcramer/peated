import type { StorePriceMatchProposal } from "@peated/server/db/schema";

export const REVIEWABLE_STORE_PRICE_MATCH_PROPOSAL_STATUSES = [
  "verified",
  "pending_review",
  "errored",
] as const satisfies ReadonlyArray<StorePriceMatchProposal["status"]>;

export const CLOSED_STORE_PRICE_MATCH_PROPOSAL_STATUSES = [
  "approved",
  "ignored",
] as const as readonly StorePriceMatchProposal["status"][];

export function isReviewableStorePriceMatchProposalStatus(
  status: StorePriceMatchProposal["status"],
): status is (typeof REVIEWABLE_STORE_PRICE_MATCH_PROPOSAL_STATUSES)[number] {
  return (
    status === "verified" || status === "pending_review" || status === "errored"
  );
}
