import { db } from "@peated/server/db";
import {
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("GET /prices/{price}/match-proposal", () => {
  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User();
    const price = await fixtures.StorePrice();
    expect(
      await waitError(
        routerClient.prices.matchQueue.priceDetails(
          { price: price.id },
          { context: { user } },
        ),
      ),
    ).toMatchObject({ status: 401 });
  });

  test("returns 404 when the price has no proposal", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const price = await fixtures.StorePrice();
    expect(
      await waitError(
        routerClient.prices.matchQueue.priceDetails(
          { price: price.id },
          { context: { user } },
        ),
      ),
    ).toMatchObject({ status: 404 });
  });

  test("finds an approved match from its price so a moderator can reopen it", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const wrongBottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: wrongBottle.id,
      name: "Store Listing For Reopen Test 46%",
      sourceFingerprint: "listing-source",
      // An old listing leaves the work list but its approval can still be wrong.
      updatedAt: new Date("2020-01-01T00:00:00.000Z"),
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "approved",
        proposalType: "match",
        currentBottleId: wrongBottle.id,
        suggestedBottleId: wrongBottle.id,
        reviewedById: user.id,
        reviewedAt: new Date(),
      })
      .returning();

    const queue = await routerClient.prices.matchQueue.list(
      {},
      { context: { user } },
    );
    expect(queue.results.map((item) => item.id)).not.toContain(proposal.id);

    const item = await routerClient.prices.matchQueue.priceDetails(
      { price: price.id },
      { context: { user } },
    );
    expect(item).toMatchObject({
      id: proposal.id,
      status: "approved",
      updatedAt: proposal.updatedAt.toISOString(),
      price: {
        id: price.id,
        sourceFingerprint: "listing-source",
        bottle: { id: wrongBottle.id },
      },
    });

    await routerClient.prices.matchQueue.reopen(
      {
        proposal: item.id,
        expectedUpdatedAt: item.updatedAt,
        expectedSourceFingerprint: item.price.sourceFingerprint,
        expectedBottleId: item.price.bottle?.id ?? null,
        reason: "The listing is the 46% release, not the 43% Bottle.",
      },
      { context: { user } },
    );
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: null });
    expect(
      await db.query.storePriceMatchProposals.findFirst({
        where: eq(storePriceMatchProposals.id, proposal.id),
      }),
    ).toMatchObject({ status: "pending_review" });
  });
});
