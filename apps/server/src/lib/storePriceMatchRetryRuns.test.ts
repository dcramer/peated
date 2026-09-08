import { db } from "@peated/server/db";
import {
  storePriceMatchProposals,
  storePriceMatchRetryRunItems,
  storePriceMatchRetryRuns,
} from "@peated/server/db/schema";
import {
  cancelStorePriceMatchRetryRun,
  processStorePriceMatchRetryRun,
} from "@peated/server/lib/storePriceMatchRetryRuns";
import { eq } from "drizzle-orm";
import { describe, expect, test, vi } from "vitest";

describe("store price match retry runs", () => {
  test("processes retry runs in chunks with no-web classifier options", async ({
    fixtures,
  }) => {
    const firstPrice = await fixtures.StorePrice({
      name: "Retry Run One",
    });
    const secondPrice = await fixtures.StorePrice({
      name: "Retry Run Two",
    });
    const [firstProposal, secondProposal] = await db
      .insert(storePriceMatchProposals)
      .values([
        {
          priceId: firstPrice.id,
          status: "pending_review",
          proposalType: "match_existing",
        },
        {
          priceId: secondPrice.id,
          status: "pending_review",
          proposalType: "match_existing",
        },
      ])
      .returning();
    const [run] = await db
      .insert(storePriceMatchRetryRuns)
      .values({
        matchedCount: 2,
        mode: "no_web",
      })
      .returning();
    await db.insert(storePriceMatchRetryRunItems).values([
      {
        priceId: firstPrice.id,
        proposalId: firstProposal!.id,
        runId: run!.id,
      },
      {
        priceId: secondPrice.id,
        proposalId: secondProposal!.id,
        runId: run!.id,
      },
    ]);

    const resolveProposal = vi.fn(async (priceId: number) => {
      const proposal = await db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.priceId, priceId),
      });
      return proposal!;
    });
    const enqueueNext = vi.fn(async () => undefined);

    await processStorePriceMatchRetryRun({
      batchSize: 1,
      delayMs: 1234,
      enqueueNext,
      resolveProposal,
      runId: run!.id,
    });

    let updatedRun = await db.query.storePriceMatchRetryRuns.findFirst({
      where: eq(storePriceMatchRetryRuns.id, run!.id),
    });
    expect(resolveProposal).toHaveBeenCalledWith(
      firstPrice.id,
      expect.objectContaining({
        candidateExpansion: "initial_only",
        force: true,
        processingToken: expect.any(String),
        reuseExistingExtraction: true,
        signal: expect.any(AbortSignal),
      }),
    );
    expect(enqueueNext).toHaveBeenCalledWith({
      delayMs: 1234,
      runId: run!.id,
    });
    expect(updatedRun).toMatchObject({
      processedCount: 1,
      reviewableCount: 1,
      status: "running",
    });

    await processStorePriceMatchRetryRun({
      batchSize: 1,
      delayMs: 1234,
      enqueueNext,
      resolveProposal,
      runId: run!.id,
    });

    updatedRun = await db.query.storePriceMatchRetryRuns.findFirst({
      where: eq(storePriceMatchRetryRuns.id, run!.id),
    });
    expect(updatedRun).toMatchObject({
      processedCount: 2,
      reviewableCount: 2,
      status: "completed",
    });
  });

  test("recovers an item abandoned by an interrupted worker", async ({
    fixtures,
  }) => {
    const price = await fixtures.StorePrice({
      name: "Retry Run Interrupted",
    });
    const exhaustedPrice = await fixtures.StorePrice({
      name: "Retry Run Interrupted Repeatedly",
    });
    const [proposal, exhaustedProposal] = await db
      .insert(storePriceMatchProposals)
      .values([
        {
          priceId: price.id,
          status: "pending_review",
          proposalType: "match_existing",
        },
        {
          priceId: exhaustedPrice.id,
          status: "pending_review",
          proposalType: "match_existing",
        },
      ])
      .returning();
    const [run] = await db
      .insert(storePriceMatchRetryRuns)
      .values({
        matchedCount: 2,
        status: "running",
      })
      .returning();
    const [item, exhaustedItem] = await db
      .insert(storePriceMatchRetryRunItems)
      .values([
        {
          attempts: 1,
          priceId: price.id,
          proposalId: proposal!.id,
          runId: run!.id,
          startedAt: new Date(Date.now() - 60_000),
          status: "processing",
        },
        {
          attempts: 3,
          priceId: exhaustedPrice.id,
          proposalId: exhaustedProposal!.id,
          runId: run!.id,
          startedAt: new Date(Date.now() - 60_000),
          status: "processing",
        },
      ])
      .returning();
    const resolveProposal = vi.fn(async () => proposal!);

    await processStorePriceMatchRetryRun({
      enqueueNext: vi.fn(async () => undefined),
      resolveProposal,
      runId: run!.id,
      staleAfterMs: 0,
    });

    const [updatedRun, updatedItem, updatedExhaustedItem] = await Promise.all([
      db.query.storePriceMatchRetryRuns.findFirst({
        where: eq(storePriceMatchRetryRuns.id, run!.id),
      }),
      db.query.storePriceMatchRetryRunItems.findFirst({
        where: eq(storePriceMatchRetryRunItems.id, item!.id),
      }),
      db.query.storePriceMatchRetryRunItems.findFirst({
        where: eq(storePriceMatchRetryRunItems.id, exhaustedItem!.id),
      }),
    ]);
    expect(resolveProposal).toHaveBeenCalledOnce();
    expect(updatedRun).toMatchObject({
      failedCount: 1,
      processedCount: 2,
      reviewableCount: 1,
      status: "completed",
    });
    expect(updatedItem).toMatchObject({
      attempts: 2,
      resultStatus: "pending_review",
      status: "completed",
    });
    expect(updatedExhaustedItem).toMatchObject({
      attempts: 3,
      status: "failed",
    });
  });

  test("fails a classifier attempt that exceeds its time limit", async ({
    fixtures,
  }) => {
    const price = await fixtures.StorePrice({
      name: "Retry Run Timeout",
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
      })
      .returning();
    const [run] = await db
      .insert(storePriceMatchRetryRuns)
      .values({ matchedCount: 1 })
      .returning();
    const [item] = await db
      .insert(storePriceMatchRetryRunItems)
      .values({
        priceId: price.id,
        proposalId: proposal!.id,
        runId: run!.id,
      })
      .returning();
    const resolveProposal = vi.fn(
      async (_priceId: number, options?: { signal?: AbortSignal }) => {
        const signal = options?.signal;
        if (!signal) throw new Error("Missing retry timeout signal.");
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        });
        return proposal!;
      },
    );

    await processStorePriceMatchRetryRun({
      enqueueNext: vi.fn(async () => undefined),
      itemTimeoutMs: 1,
      resolveProposal,
      runId: run!.id,
    });

    const [updatedRun, updatedItem] = await Promise.all([
      db.query.storePriceMatchRetryRuns.findFirst({
        where: eq(storePriceMatchRetryRuns.id, run!.id),
      }),
      db.query.storePriceMatchRetryRunItems.findFirst({
        where: eq(storePriceMatchRetryRunItems.id, item!.id),
      }),
    ]);
    expect(updatedRun).toMatchObject({
      failedCount: 1,
      processedCount: 1,
      status: "completed",
    });
    expect(updatedItem).toMatchObject({
      status: "failed",
    });
  });

  test("cancels pending retry run items without calling upstream work", async ({
    fixtures,
  }) => {
    const price = await fixtures.StorePrice({
      name: "Retry Run Cancel",
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
      })
      .returning();
    const [run] = await db
      .insert(storePriceMatchRetryRuns)
      .values({
        cancelRequestedAt: new Date(),
        matchedCount: 1,
        status: "running",
      })
      .returning();
    await db.insert(storePriceMatchRetryRunItems).values({
      priceId: price.id,
      proposalId: proposal!.id,
      runId: run!.id,
    });

    const resolveProposal = vi.fn();

    await processStorePriceMatchRetryRun({
      resolveProposal,
      runId: run!.id,
    });

    const updatedRun = await db.query.storePriceMatchRetryRuns.findFirst({
      where: eq(storePriceMatchRetryRuns.id, run!.id),
    });
    expect(resolveProposal).not.toHaveBeenCalled();
    expect(updatedRun).toMatchObject({
      processedCount: 1,
      skippedCount: 1,
      status: "canceled",
    });
  });

  test("does not let in-flight work revive a canceled retry run", async ({
    fixtures,
  }) => {
    const price = await fixtures.StorePrice({
      name: "Retry Run In Flight Cancel",
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "pending_review",
        proposalType: "match_existing",
      })
      .returning();
    const [run] = await db
      .insert(storePriceMatchRetryRuns)
      .values({
        matchedCount: 1,
        status: "running",
      })
      .returning();
    const [item] = await db
      .insert(storePriceMatchRetryRunItems)
      .values({
        priceId: price.id,
        proposalId: proposal!.id,
        runId: run!.id,
      })
      .returning();

    let finishResolution!: (value: NonNullable<typeof proposal>) => void;
    const resolveProposal = vi.fn(
      () =>
        new Promise<NonNullable<typeof proposal>>((resolve) => {
          finishResolution = resolve;
        }),
    );
    const enqueueNext = vi.fn(async () => undefined);
    const processing = processStorePriceMatchRetryRun({
      enqueueNext,
      resolveProposal,
      runId: run!.id,
    });

    await vi.waitFor(() => expect(resolveProposal).toHaveBeenCalledOnce());
    expect(enqueueNext).toHaveBeenCalledOnce();
    await cancelStorePriceMatchRetryRun(run!.id);
    finishResolution(proposal!);
    await processing;

    const [updatedRun, updatedItem] = await Promise.all([
      db.query.storePriceMatchRetryRuns.findFirst({
        where: eq(storePriceMatchRetryRuns.id, run!.id),
      }),
      db.query.storePriceMatchRetryRunItems.findFirst({
        where: eq(storePriceMatchRetryRunItems.id, item!.id),
      }),
    ]);
    expect(updatedRun).toMatchObject({
      processedCount: 1,
      reviewableCount: 0,
      skippedCount: 1,
      status: "canceled",
    });
    expect(updatedItem).toMatchObject({
      resultStatus: null,
      status: "skipped",
    });
  });
});
