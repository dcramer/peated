import { db } from "@peated/server/db";
import {
  incomingBottleDecisionLogs,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test, vi } from "vitest";

describe("POST /prices/match-queue/{proposal}/reopen", () => {
  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User();
    expect(
      await waitError(
        routerClient.prices.matchQueue.reopen(
          {
            proposal: 1,
            expectedUpdatedAt: new Date().toISOString(),
            expectedSourceFingerprint: null,
          },
          { context: { user } },
        ),
      ),
    ).toMatchObject({ status: 401 });
  });

  test("reopens a cleared approved match for manual review, not automatic reuse", async ({
    fixtures,
  }) => {
    vi.mocked(workerClient.pushUniqueJob).mockClear();
    const user = await fixtures.User({ mod: true });
    const oldBottle = await fixtures.Bottle();
    const target = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: null,
      sourceFingerprint: "unchanged-source",
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "approved",
        proposalType: "match",
        currentBottleId: oldBottle.id,
        suggestedBottleId: oldBottle.id,
        referenceScope: "global_alias",
        reviewedById: user.id,
        reviewedAt: new Date(),
      })
      .returning();
    const input = {
      proposal: proposal.id,
      expectedUpdatedAt: proposal.updatedAt.toISOString(),
      expectedSourceFingerprint: price.sourceFingerprint,
    };
    const details = await routerClient.prices.matchQueue.details(
      { proposal: proposal.id },
      { context: { user } },
    );
    expect(details.price.sourceFingerprint).toBe(
      input.expectedSourceFingerprint,
    );
    expect(details.updatedAt).toBe(input.expectedUpdatedAt);
    for (const stale of [
      { ...input, expectedUpdatedAt: "2000-01-01T00:00:00.000Z" },
      { ...input, expectedSourceFingerprint: "changed" },
    ]) {
      expect(
        await waitError(
          routerClient.prices.matchQueue.reopen(stale, { context: { user } }),
        ),
      ).toMatchObject({ status: 409 });
    }
    await routerClient.prices.matchQueue.reopen(input, { context: { user } });
    expect(
      await db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, proposal.id),
      }),
    ).toMatchObject({
      status: "pending_review",
      proposalType: "no_match",
      currentBottleId: null,
      suggestedBottleId: null,
      referenceScope: "none",
      automationAssessment: null,
      reviewedById: null,
      reviewedAt: null,
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
    expect(
      await db.query.incomingBottleDecisionLogs.findFirst({
        where: eq(incomingBottleDecisionLogs.sourceId, price.id),
      }),
    ).toMatchObject({
      decision: "unassign",
      bottleId: null,
      metadata: {
        previousProposal: {
          status: "approved",
          bottleId: oldBottle.id,
          reviewedById: user.id,
          reviewedAt: proposal.reviewedAt!.toISOString(),
          referenceScope: "global_alias",
        },
      },
    });
    await routerClient.prices.matchQueue.resolve(
      { proposal: proposal.id, action: "match", bottle: target.id },
      { context: { user } },
    );
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: target.id, matchedReferenceId: null });
  });

  test("does not reopen an assigned price or an active evaluation", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({ bottleId: bottle.id });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({ priceId: price.id, status: "approved", proposalType: "match" })
      .returning();
    const input = {
      proposal: proposal.id,
      expectedUpdatedAt: proposal.updatedAt.toISOString(),
      expectedSourceFingerprint: price.sourceFingerprint,
    };
    expect(
      await waitError(
        routerClient.prices.matchQueue.reopen(input, { context: { user } }),
      ),
    ).toMatchObject({ status: 409 });
    await db
      .update(storePrices)
      .set({ bottleId: null })
      .where(eq(storePrices.id, price.id));
    await db
      .update(storePriceMatchProposals)
      .set({ processingToken: "active" })
      .where(eq(storePriceMatchProposals.id, proposal.id));
    expect(
      await waitError(
        routerClient.prices.matchQueue.reopen(input, { context: { user } }),
      ),
    ).toMatchObject({ status: 409 });
  });
});
