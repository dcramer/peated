import { db } from "@peated/server/db";
import {
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import * as workerClient from "@peated/server/worker/client";
import "@peated/server/worker/jobs";
import reconcileStorePriceMatchProposals from "@peated/server/worker/jobs/reconcileStorePriceMatchProposals";
import registry from "@peated/server/worker/registry";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@peated/server/worker/client", () => ({
  pushJob: vi.fn(),
}));

async function agePrice(priceId: number, minutes: number) {
  await db
    .update(storePrices)
    .set({
      updatedAt: sql`NOW() - make_interval(mins => ${minutes})`,
    })
    .where(eq(storePrices.id, priceId));
}

describe("reconcileStorePriceMatchProposals", () => {
  beforeEach(() => {
    vi.mocked(workerClient.pushJob).mockReset();
  });

  test("queues resolver jobs for unmatched store prices without proposals", async ({
    fixtures,
  }) => {
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Unmatched Store Listing",
    });
    await agePrice(price.id, 60);

    const result = await reconcileStorePriceMatchProposals();

    expect(result).toEqual({ queuedCount: 1 });
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      {
        priceId: price.id,
      },
    );
  });

  test("skips prices that already have proposals", async ({ fixtures }) => {
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Already Proposed Listing",
    });
    await agePrice(price.id, 60);

    await db.insert(storePriceMatchProposals).values({
      priceId: price.id,
      proposalType: "create_new",
      status: "pending_review",
    });

    const result = await reconcileStorePriceMatchProposals();

    expect(result).toEqual({ queuedCount: 0 });
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("skips matched and hidden prices", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const matchedPrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: "Matched Store Listing",
    });
    const hiddenPrice = await fixtures.StorePrice({
      bottleId: null,
      hidden: true,
      name: "Hidden Store Listing",
    });
    await agePrice(matchedPrice.id, 60);
    await agePrice(hiddenPrice.id, 60);

    const result = await reconcileStorePriceMatchProposals();

    expect(result).toEqual({ queuedCount: 0 });
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("honors the minimum age guard", async ({ fixtures }) => {
    const freshPrice = await fixtures.StorePrice({
      bottleId: null,
      name: "Fresh Store Listing",
    });
    const oldPrice = await fixtures.StorePrice({
      bottleId: null,
      name: "Old Store Listing",
    });
    await agePrice(freshPrice.id, 5);
    await agePrice(oldPrice.id, 60);

    const result = await reconcileStorePriceMatchProposals({
      minAgeMinutes: 30,
    });

    expect(result).toEqual({ queuedCount: 1 });
    expect(workerClient.pushJob).toHaveBeenCalledTimes(1);
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      {
        priceId: oldPrice.id,
      },
    );
    expect(workerClient.pushJob).not.toHaveBeenCalledWith(
      "ResolveStorePriceBottle",
      {
        priceId: freshPrice.id,
      },
    );
  });

  test("continues queueing prices after a dispatch failure", async ({
    fixtures,
  }) => {
    const newerPrice = await fixtures.StorePrice({
      bottleId: null,
      name: "Newer Unmatched Store Listing",
    });
    const olderPrice = await fixtures.StorePrice({
      bottleId: null,
      name: "Older Unmatched Store Listing",
    });
    await agePrice(newerPrice.id, 60);
    await agePrice(olderPrice.id, 120);

    const error = new Error("queue unavailable");
    vi.mocked(workerClient.pushJob)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(undefined);

    const result = await reconcileStorePriceMatchProposals();

    expect(result).toEqual({ queuedCount: 1 });
    expect(workerClient.pushJob).toHaveBeenCalledTimes(2);
    expect(workerClient.pushJob).toHaveBeenNthCalledWith(
      1,
      "ResolveStorePriceBottle",
      {
        priceId: newerPrice.id,
      },
    );
    expect(workerClient.pushJob).toHaveBeenNthCalledWith(
      2,
      "ResolveStorePriceBottle",
      {
        priceId: olderPrice.id,
      },
    );
  });

  test("is registered as a worker job", () => {
    expect(registry.get("ReconcileStorePriceMatchProposals")).toBeTypeOf(
      "function",
    );
  });
});
