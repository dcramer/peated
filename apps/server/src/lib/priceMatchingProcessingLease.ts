import { db } from "@peated/server/db";
import {
  storePriceMatchProposals,
  type StorePriceMatchProposal,
} from "@peated/server/db/schema";
import {
  REVIEWABLE_STORE_PRICE_MATCH_PROPOSAL_STATUSES,
  isReviewableStorePriceMatchProposalStatus,
} from "@peated/server/lib/priceMatchingStatus";
import { randomUUID } from "crypto";
import { and, eq, inArray, sql } from "drizzle-orm";

export const STORE_PRICE_MATCH_PROCESSING_LEASE_MS = 30 * 60 * 1000;

export type StorePriceMatchProposalProcessingLeaseResult =
  | {
      status: "claimed";
      proposal: StorePriceMatchProposal;
      processingToken: string;
    }
  | {
      status: "already_processing" | "not_found" | "not_retryable";
      proposal: StorePriceMatchProposal | null;
      processingToken: string;
    };

function getProcessingLeaseExpirySql(leaseMs: number) {
  return sql`NOW() + ${leaseMs} * interval '1 millisecond'`;
}

export function hasActiveStorePriceMatchProposalProcessingLease(
  proposal: Pick<StorePriceMatchProposal, "processingExpiresAt">,
  now = new Date(),
): boolean {
  return (
    proposal.processingExpiresAt !== null &&
    proposal.processingExpiresAt.getTime() > now.getTime()
  );
}

export async function claimStorePriceMatchProposalProcessingLease({
  proposalId,
  processingToken = randomUUID(),
  leaseMs = STORE_PRICE_MATCH_PROCESSING_LEASE_MS,
}: {
  proposalId: number;
  processingToken?: string;
  leaseMs?: number;
}): Promise<StorePriceMatchProposalProcessingLeaseResult> {
  const [proposal] = await db
    .update(storePriceMatchProposals)
    .set({
      processingToken,
      processingQueuedAt: sql`NOW()`,
      processingExpiresAt: getProcessingLeaseExpirySql(leaseMs),
    })
    .where(
      and(
        eq(storePriceMatchProposals.id, proposalId),
        inArray(storePriceMatchProposals.status, [
          ...REVIEWABLE_STORE_PRICE_MATCH_PROPOSAL_STATUSES,
        ]),
        sql`(${storePriceMatchProposals.processingExpiresAt} IS NULL OR ${storePriceMatchProposals.processingExpiresAt} <= NOW())`,
      ),
    )
    .returning();

  if (proposal) {
    return {
      status: "claimed",
      proposal,
      processingToken,
    };
  }

  const existingProposal = await db.query.storePriceMatchProposals.findFirst({
    where: eq(storePriceMatchProposals.id, proposalId),
  });

  if (!existingProposal) {
    return {
      status: "not_found",
      proposal: null,
      processingToken,
    };
  }

  if (!isReviewableStorePriceMatchProposalStatus(existingProposal.status)) {
    return {
      status: "not_retryable",
      proposal: existingProposal,
      processingToken,
    };
  }

  return {
    status: "already_processing",
    proposal: existingProposal,
    processingToken,
  };
}

export async function refreshStorePriceMatchProposalProcessingLease({
  proposalId,
  processingToken,
  leaseMs = STORE_PRICE_MATCH_PROCESSING_LEASE_MS,
}: {
  proposalId: number;
  processingToken: string;
  leaseMs?: number;
}): Promise<boolean> {
  const [proposal] = await db
    .update(storePriceMatchProposals)
    .set({
      processingExpiresAt: getProcessingLeaseExpirySql(leaseMs),
    })
    .where(
      and(
        eq(storePriceMatchProposals.id, proposalId),
        eq(storePriceMatchProposals.processingToken, processingToken),
        sql`${storePriceMatchProposals.processingExpiresAt} IS NOT NULL AND ${storePriceMatchProposals.processingExpiresAt} > NOW()`,
      ),
    )
    .returning({
      id: storePriceMatchProposals.id,
    });

  return !!proposal;
}

export async function releaseStorePriceMatchProposalProcessingLease({
  proposalId,
  processingToken,
}: {
  proposalId: number;
  processingToken: string;
}): Promise<void> {
  await db
    .update(storePriceMatchProposals)
    .set({
      processingToken: null,
      processingQueuedAt: null,
      processingExpiresAt: null,
    })
    .where(
      and(
        eq(storePriceMatchProposals.id, proposalId),
        eq(storePriceMatchProposals.processingToken, processingToken),
      ),
    );
}
