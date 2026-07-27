import { db } from "@peated/server/db";
import {
  bottleTombstones,
  reviews,
  storePrices,
} from "@peated/server/db/schema";
import * as workerClient from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import onBottleAliasChange from "./onBottleAliasChange";

vi.mock("@peated/server/worker/client", () => ({
  runJob: vi.fn(),
}));

describe("onBottleAliasChange", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("replays one active Bottle assignment without overwriting direct consumers", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const alias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Direct Bottle Worker Alias",
    });
    const unresolvedReview = await fixtures.Review({
      bottleId: null,
      name: alias.name,
    });
    const unresolvedPrice = await fixtures.StorePrice({
      bottleId: null,
      name: alias.name,
    });
    const assignedReview = await fixtures.Review({
      bottleId: otherBottle.id,
      name: alias.name,
      issue: "Independent assignment",
    });
    const assignedPrice = await fixtures.StorePrice({
      bottleId: otherBottle.id,
      name: alias.name,
      volume: 1_000,
    });

    await onBottleAliasChange({ name: alias.name.toUpperCase() });
    await onBottleAliasChange({ name: alias.name });

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, unresolvedReview.id),
      }),
    ).toMatchObject({ bottleId: bottle.id });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, unresolvedPrice.id),
      }),
    ).toMatchObject({ bottleId: bottle.id });
    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, assignedReview.id),
      }),
    ).toMatchObject({ bottleId: otherBottle.id });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, assignedPrice.id),
      }),
    ).toMatchObject({ bottleId: otherBottle.id });
    expect(workerClient.runJob).toHaveBeenCalledTimes(2);
    expect(workerClient.runJob).toHaveBeenLastCalledWith("IndexBottleAlias", {
      name: alias.name,
    });
  });

  test("does not propagate ignored or unbound aliases", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const ignoredAlias = await fixtures.BottleAlias({
      bottleId: bottle.id,
      ignored: true,
      name: "Ignored Worker Alias",
    });
    const unboundAlias = await fixtures.BottleAlias({
      bottleId: null,
      name: "Unbound Worker Alias",
    });
    const ignoredReview = await fixtures.Review({
      bottleId: null,
      name: ignoredAlias.name,
    });
    const unboundPrice = await fixtures.StorePrice({
      bottleId: null,
      name: unboundAlias.name,
    });

    await onBottleAliasChange({ name: ignoredAlias.name });
    await onBottleAliasChange({ name: unboundAlias.name });

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, ignoredReview.id),
      }),
    ).toMatchObject({ bottleId: null });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, unboundPrice.id),
      }),
    ).toMatchObject({ bottleId: null });
    expect(workerClient.runJob).toHaveBeenNthCalledWith(1, "IndexBottleAlias", {
      name: ignoredAlias.name,
    });
    expect(workerClient.runJob).toHaveBeenNthCalledWith(2, "IndexBottleAlias", {
      name: unboundAlias.name,
    });
  });

  test("does not propagate a retired Bottle assignment", async ({
    fixtures,
  }) => {
    const retiredBottle = await fixtures.Bottle();
    const replacementBottle = await fixtures.Bottle();
    const alias = await fixtures.BottleAlias({
      bottleId: retiredBottle.id,
      name: "Retired Bottle Worker Alias",
    });
    const review = await fixtures.Review({
      bottleId: null,
      name: alias.name,
    });
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: replacementBottle.id,
    });

    await onBottleAliasChange({ name: alias.name });

    expect(
      await db.query.reviews.findFirst({
        where: eq(reviews.id, review.id),
      }),
    ).toMatchObject({ bottleId: null });
    expect(workerClient.runJob).toHaveBeenCalledWith("IndexBottleAlias", {
      name: alias.name,
    });
  });

  test("rejects an unknown alias before scheduling indexing", async () => {
    await expect(
      onBottleAliasChange({ name: "Unknown Bottle Alias" }),
    ).rejects.toThrow("Unknown bottle alias: Unknown Bottle Alias");
    expect(workerClient.runJob).not.toHaveBeenCalled();
  });
});
