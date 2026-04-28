import { db } from "@peated/server/db";
import {
  storePriceMatchProposals,
  storePriceMatchRetryRunItems,
  storePriceMatchRetryRuns,
} from "@peated/server/db/schema";
import { processStorePriceMatchRetryRun } from "@peated/server/lib/storePriceMatchRetryRuns";
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
});
