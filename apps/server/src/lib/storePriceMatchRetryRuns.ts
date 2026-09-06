import type { CandidateExpansionMode } from "@peated/bottle-classifier/contract";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import {
  storePriceMatchProposals,
  storePriceMatchRetryRunItems,
  storePriceMatchRetryRuns,
  type StorePriceMatchProposal,
  type StorePriceMatchRetryRun,
  type StorePriceMatchRetryRunItem,
} from "@peated/server/db/schema";
import {
  claimStorePriceMatchProposalProcessingLease,
  releaseStorePriceMatchProposalProcessingLease,
} from "@peated/server/lib/priceMatchingProcessingLease";
import { resolveStorePriceMatchProposal } from "@peated/server/lib/priceMatchingProposals";
import { and, asc, eq, exists, inArray, sql } from "drizzle-orm";

export const STORE_PRICE_MATCH_RETRY_RUN_TERMINAL_STATUSES = [
  "completed",
  "failed",
  "canceled",
] as const satisfies ReadonlyArray<StorePriceMatchRetryRun["status"]>;

export type StorePriceMatchRetryRunMode = StorePriceMatchRetryRun["mode"];

export type SerializedStorePriceMatchRetryRun = {
  cancelRequestedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  erroredCount: number;
  failedCount: number;
  id: number;
  kind: StorePriceMatchRetryRun["kind"];
  matchedCount: number;
  mode: StorePriceMatchRetryRun["mode"];
  pendingCount: number;
  processedCount: number;
  progress: number;
  query: string;
  resolvedCount: number;
  reviewableCount: number;
  site: StorePriceMatchRetryRun["site"];
  skippedCount: number;
  startedAt: string | null;
  status: StorePriceMatchRetryRun["status"];
  updatedAt: string;
};

type ResolveStorePriceMatchProposal = typeof resolveStorePriceMatchProposal;

interface RetryRunModeOptions {
  candidateExpansion: CandidateExpansionMode;
  reuseExistingExtraction: boolean;
}

function isTerminalRetryRunStatus(status: StorePriceMatchRetryRun["status"]) {
  return STORE_PRICE_MATCH_RETRY_RUN_TERMINAL_STATUSES.some(
    (terminalStatus) => terminalStatus === status,
  );
}

function getRetryRunModeOptions(
  mode: StorePriceMatchRetryRunMode,
): RetryRunModeOptions {
  if (mode === "no_web") {
    return {
      candidateExpansion: "initial_only",
      reuseExistingExtraction: true,
    };
  }

  return {
    candidateExpansion: "open",
    reuseExistingExtraction: false,
  };
}

function getFinishedCounter(
  status: StorePriceMatchProposal["status"],
): "erroredCount" | "resolvedCount" | "reviewableCount" {
  if (status === "errored") {
    return "erroredCount";
  }

  if (status === "pending_review") {
    return "reviewableCount";
  }

  return "resolvedCount";
}

export function serializeStorePriceMatchRetryRun(
  run: StorePriceMatchRetryRun,
): SerializedStorePriceMatchRetryRun {
  const pendingCount = Math.max(0, run.matchedCount - run.processedCount);

  return {
    cancelRequestedAt: run.cancelRequestedAt
      ? run.cancelRequestedAt.toISOString()
      : null,
    completedAt: run.completedAt ? run.completedAt.toISOString() : null,
    createdAt: run.createdAt.toISOString(),
    erroredCount: run.erroredCount,
    failedCount: run.failedCount,
    id: run.id,
    kind: run.kind,
    matchedCount: run.matchedCount,
    mode: run.mode,
    pendingCount,
    processedCount: run.processedCount,
    progress:
      run.matchedCount > 0
        ? Math.min(
            100,
            Math.round((run.processedCount / run.matchedCount) * 100),
          )
        : 100,
    query: run.query,
    resolvedCount: run.resolvedCount,
    reviewableCount: run.reviewableCount,
    site: run.site,
    skippedCount: run.skippedCount,
    startedAt: run.startedAt ? run.startedAt.toISOString() : null,
    status: run.status,
    updatedAt: run.updatedAt.toISOString(),
  };
}

export async function enqueueStorePriceMatchRetryRunJob({
  delayMs = 0,
  runId,
}: {
  delayMs?: number;
  runId: number;
}) {
  const { pushJob } = await import("@peated/server/worker/dispatch");

  await pushJob(
    "ProcessStorePriceMatchRetryRun",
    {
      runId,
    },
    {
      delay: delayMs,
      removeOnComplete: true,
    },
  );
}

async function claimRetryRunItems({
  batchSize,
  runId,
}: {
  batchSize: number;
  runId: number;
}) {
  return await db.transaction(async (tx) => {
    const pendingItems = await tx
      .select({
        id: storePriceMatchRetryRunItems.id,
      })
      .from(storePriceMatchRetryRunItems)
      .where(
        and(
          eq(storePriceMatchRetryRunItems.runId, runId),
          eq(storePriceMatchRetryRunItems.status, "pending"),
        ),
      )
      .orderBy(asc(storePriceMatchRetryRunItems.id))
      .limit(batchSize);

    const itemIds = pendingItems.map((item) => item.id);
    if (!itemIds.length) {
      const noItems: StorePriceMatchRetryRunItem[] = [];
      return noItems;
    }

    return await tx
      .update(storePriceMatchRetryRunItems)
      .set({
        attempts: sql`${storePriceMatchRetryRunItems.attempts} + 1`,
        startedAt: sql`NOW()`,
        status: "processing",
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          inArray(storePriceMatchRetryRunItems.id, itemIds),
          eq(storePriceMatchRetryRunItems.status, "pending"),
        ),
      )
      .returning();
  });
}

async function markRetryRunItemCompleted({
  item,
  resultStatus,
}: {
  item: StorePriceMatchRetryRunItem;
  resultStatus: StorePriceMatchProposal["status"];
}) {
  const counter = getFinishedCounter(resultStatus);

  await db.transaction(async (tx) => {
    const [updatedItem] = await tx
      .update(storePriceMatchRetryRunItems)
      .set({
        completedAt: sql`NOW()`,
        resultStatus,
        status: "completed",
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(storePriceMatchRetryRunItems.id, item.id),
          eq(storePriceMatchRetryRunItems.status, "processing"),
        ),
      )
      .returning({ id: storePriceMatchRetryRunItems.id });

    if (!updatedItem) return;

    await tx
      .update(storePriceMatchRetryRuns)
      .set({
        [counter]: sql`${storePriceMatchRetryRuns[counter]} + 1`,
        processedCount: sql`${storePriceMatchRetryRuns.processedCount} + 1`,
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(storePriceMatchRetryRuns.id, item.runId),
          inArray(storePriceMatchRetryRuns.status, ["pending", "running"]),
        ),
      );
  });
}

async function markRetryRunItemSkipped({
  error,
  item,
}: {
  error: string;
  item: StorePriceMatchRetryRunItem;
}) {
  await db.transaction(async (tx) => {
    const [updatedItem] = await tx
      .update(storePriceMatchRetryRunItems)
      .set({
        completedAt: sql`NOW()`,
        error,
        status: "skipped",
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(storePriceMatchRetryRunItems.id, item.id),
          eq(storePriceMatchRetryRunItems.status, "processing"),
        ),
      )
      .returning({ id: storePriceMatchRetryRunItems.id });

    if (!updatedItem) return;

    await tx
      .update(storePriceMatchRetryRuns)
      .set({
        processedCount: sql`${storePriceMatchRetryRuns.processedCount} + 1`,
        skippedCount: sql`${storePriceMatchRetryRuns.skippedCount} + 1`,
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(storePriceMatchRetryRuns.id, item.runId),
          inArray(storePriceMatchRetryRuns.status, ["pending", "running"]),
        ),
      );
  });
}

async function markRetryRunItemFailed({
  error,
  item,
}: {
  error: string;
  item: StorePriceMatchRetryRunItem;
}) {
  await db.transaction(async (tx) => {
    const [updatedItem] = await tx
      .update(storePriceMatchRetryRunItems)
      .set({
        completedAt: sql`NOW()`,
        error,
        status: "failed",
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(storePriceMatchRetryRunItems.id, item.id),
          eq(storePriceMatchRetryRunItems.status, "processing"),
        ),
      )
      .returning({ id: storePriceMatchRetryRunItems.id });

    if (!updatedItem) return;

    await tx
      .update(storePriceMatchRetryRuns)
      .set({
        failedCount: sql`${storePriceMatchRetryRuns.failedCount} + 1`,
        processedCount: sql`${storePriceMatchRetryRuns.processedCount} + 1`,
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(storePriceMatchRetryRuns.id, item.runId),
          inArray(storePriceMatchRetryRuns.status, ["pending", "running"]),
        ),
      );
  });
}

export async function cancelStorePriceMatchRetryRun(runId: number) {
  return await db.transaction(async (tx) => {
    const skippedItems = await tx
      .update(storePriceMatchRetryRunItems)
      .set({
        completedAt: sql`NOW()`,
        error: "Retry run canceled.",
        status: "skipped",
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(storePriceMatchRetryRunItems.runId, runId),
          inArray(storePriceMatchRetryRunItems.status, [
            "pending",
            "processing",
          ]),
          exists(
            tx
              .select({ id: storePriceMatchRetryRuns.id })
              .from(storePriceMatchRetryRuns)
              .where(
                and(
                  eq(storePriceMatchRetryRuns.id, runId),
                  inArray(storePriceMatchRetryRuns.status, [
                    "pending",
                    "running",
                  ]),
                ),
              ),
          ),
        ),
      )
      .returning({
        id: storePriceMatchRetryRunItems.id,
      });

    const [run] = await tx
      .update(storePriceMatchRetryRuns)
      .set({
        cancelRequestedAt: sql`COALESCE(${storePriceMatchRetryRuns.cancelRequestedAt}, NOW())`,
        completedAt: sql`NOW()`,
        processedCount: sql`${storePriceMatchRetryRuns.processedCount} + ${skippedItems.length}`,
        skippedCount: sql`${storePriceMatchRetryRuns.skippedCount} + ${skippedItems.length}`,
        status: "canceled",
        updatedAt: sql`NOW()`,
      })
      .where(
        and(
          eq(storePriceMatchRetryRuns.id, runId),
          inArray(storePriceMatchRetryRuns.status, ["pending", "running"]),
        ),
      )
      .returning();

    if (run) return run;

    return (
      (await tx.query.storePriceMatchRetryRuns.findFirst({
        where: eq(storePriceMatchRetryRuns.id, runId),
      })) ?? null
    );
  });
}

async function completeRetryRunIfDone(runId: number) {
  const [remaining] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(storePriceMatchRetryRunItems)
    .where(
      and(
        eq(storePriceMatchRetryRunItems.runId, runId),
        inArray(storePriceMatchRetryRunItems.status, ["pending", "processing"]),
      ),
    );

  if ((remaining?.count ?? 0) > 0) {
    return null;
  }

  const [run] = await db
    .update(storePriceMatchRetryRuns)
    .set({
      completedAt: sql`NOW()`,
      status: "completed",
      updatedAt: sql`NOW()`,
    })
    .where(
      and(
        eq(storePriceMatchRetryRuns.id, runId),
        inArray(storePriceMatchRetryRuns.status, ["pending", "running"]),
      ),
    )
    .returning();

  if (run) return run;

  return (
    (await db.query.storePriceMatchRetryRuns.findFirst({
      where: eq(storePriceMatchRetryRuns.id, runId),
    })) ?? null
  );
}

async function processRetryRunItem({
  item,
  mode,
  resolveProposal,
}: {
  item: StorePriceMatchRetryRunItem;
  mode: StorePriceMatchRetryRunMode;
  resolveProposal: ResolveStorePriceMatchProposal;
}) {
  const lease = await claimStorePriceMatchProposalProcessingLease({
    proposalId: item.proposalId,
  });

  if (lease.status !== "claimed") {
    await markRetryRunItemSkipped({
      error: `Proposal is ${lease.status}.`,
      item,
    });
    return;
  }

  try {
    const proposal = await resolveProposal(item.priceId, {
      force: true,
      processingToken: lease.processingToken,
      ...getRetryRunModeOptions(mode),
    });
    await markRetryRunItemCompleted({
      item,
      resultStatus: proposal.status,
    });
  } catch (error) {
    await releaseStorePriceMatchProposalProcessingLease({
      proposalId: item.proposalId,
      processingToken: lease.processingToken,
    });

    await markRetryRunItemFailed({
      error: error instanceof Error ? error.message : "Unknown retry error",
      item,
    });
  }
}

export async function processStorePriceMatchRetryRun({
  batchSize = config.PRICE_MATCH_RETRY_RUN_BATCH_SIZE,
  delayMs = config.PRICE_MATCH_RETRY_RUN_DELAY_MS,
  enqueueNext = enqueueStorePriceMatchRetryRunJob,
  resolveProposal = resolveStorePriceMatchProposal,
  runId,
}: {
  batchSize?: number;
  delayMs?: number;
  enqueueNext?: (args: { delayMs?: number; runId: number }) => Promise<void>;
  resolveProposal?: ResolveStorePriceMatchProposal;
  runId: number;
}) {
  const existingRun = await db.query.storePriceMatchRetryRuns.findFirst({
    where: eq(storePriceMatchRetryRuns.id, runId),
  });

  if (!existingRun || isTerminalRetryRunStatus(existingRun.status)) {
    return existingRun ?? null;
  }

  if (existingRun.cancelRequestedAt) {
    return await cancelStorePriceMatchRetryRun(runId);
  }

  await db
    .update(storePriceMatchRetryRuns)
    .set({
      startedAt: existingRun.startedAt ?? sql`NOW()`,
      status: "running",
      updatedAt: sql`NOW()`,
    })
    .where(eq(storePriceMatchRetryRuns.id, runId));

  const items = await claimRetryRunItems({ batchSize, runId });
  if (!items.length) {
    return await completeRetryRunIfDone(runId);
  }

  for (const item of items) {
    const currentRun = await db.query.storePriceMatchRetryRuns.findFirst({
      where: eq(storePriceMatchRetryRuns.id, runId),
    });

    if (!currentRun || currentRun.cancelRequestedAt) {
      return await cancelStorePriceMatchRetryRun(runId);
    }

    await processRetryRunItem({
      item,
      mode: currentRun.mode,
      resolveProposal,
    });
  }

  const completedRun = await completeRetryRunIfDone(runId);
  if (completedRun) {
    return completedRun;
  }

  await enqueueNext({ delayMs, runId });

  return await db.query.storePriceMatchRetryRuns.findFirst({
    where: eq(storePriceMatchRetryRuns.id, runId),
  });
}
