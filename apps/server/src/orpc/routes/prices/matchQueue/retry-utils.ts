import {
  claimStorePriceMatchProposalProcessingLease,
  releaseStorePriceMatchProposalProcessingLease,
} from "@peated/server/lib/priceMatching";
import { pushUniqueJob } from "@peated/server/worker/client";

export type StorePriceMatchRetryEnqueueResult =
  | {
      status: "queued";
    }
  | {
      status: "already_processing" | "not_found" | "not_retryable";
    };

export async function enqueueStorePriceMatchRetry({
  proposalId,
  priceId,
}: {
  proposalId: number;
  priceId: number;
}): Promise<StorePriceMatchRetryEnqueueResult> {
  const lease = await claimStorePriceMatchProposalProcessingLease({
    proposalId,
  });

  if (lease.status !== "claimed") {
    return {
      status: lease.status,
    };
  }

  try {
    await pushUniqueJob("ResolveStorePriceBottle", {
      priceId,
      force: true,
      processingToken: lease.processingToken,
    });

    return {
      status: "queued",
    };
  } catch (error) {
    await releaseStorePriceMatchProposalProcessingLease({
      proposalId,
      processingToken: lease.processingToken,
    });
    throw error;
  }
}
