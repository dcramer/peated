import { db } from "@peated/server/db";
import {
  bottleTombstones,
  externalReviews,
  storePrices,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { JobPayload } from "../types";
import {
  onBottleReferenceChange as onBottleReferenceChangeWithServices,
  type OnBottleReferenceChangeServices,
} from "./onBottleReferenceChange";

let runReferenceIndex: ReturnType<
  typeof vi.fn<OnBottleReferenceChangeServices["runReferenceIndex"]>
>;

function onBottleReferenceChange(input: JobPayload) {
  return onBottleReferenceChangeWithServices(input, { runReferenceIndex });
}

describe("onBottleReferenceChange", () => {
  beforeEach(() => {
    runReferenceIndex = vi.fn();
  });

  test("replays one active Bottle assignment without overwriting direct consumers", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const reference = await fixtures.BottleReference({
      bottleId: bottle.id,
      name: "Direct Bottle Worker Reference",
    });
    const unresolvedReview = await fixtures.ExternalReview({
      bottleId: null,
      name: reference.name,
    });
    const unresolvedPrice = await fixtures.StorePrice({
      bottleId: null,
      name: reference.name,
    });
    const assignedReview = await fixtures.ExternalReview({
      bottleId: otherBottle.id,
      name: reference.name,
      issue: "Independent assignment",
    });
    const assignedPrice = await fixtures.StorePrice({
      bottleId: otherBottle.id,
      name: reference.name,
      volume: 1_000,
    });

    await onBottleReferenceChange({ name: reference.name.toUpperCase() });
    await onBottleReferenceChange({ name: reference.name });

    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, unresolvedReview.id),
      }),
    ).toMatchObject({ bottleId: bottle.id });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, unresolvedPrice.id),
      }),
    ).toMatchObject({ bottleId: bottle.id });
    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, assignedReview.id),
      }),
    ).toMatchObject({ bottleId: otherBottle.id });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, assignedPrice.id),
      }),
    ).toMatchObject({ bottleId: otherBottle.id });
    expect(runReferenceIndex).toHaveBeenCalledTimes(2);
    expect(runReferenceIndex).toHaveBeenLastCalledWith(reference.name);
  });

  test("does not propagate ignored or unbound aliases", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const ignoredAlias = await fixtures.BottleReference({
      bottleId: bottle.id,
      ignored: true,
      name: "Ignored Worker Reference",
    });
    const unboundAlias = await fixtures.BottleReference({
      bottleId: null,
      name: "Unbound Worker Reference",
    });
    const ignoredReview = await fixtures.ExternalReview({
      bottleId: null,
      name: ignoredAlias.name,
    });
    const unboundPrice = await fixtures.StorePrice({
      bottleId: null,
      name: unboundAlias.name,
    });

    await onBottleReferenceChange({ name: ignoredAlias.name });
    await onBottleReferenceChange({ name: unboundAlias.name });

    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, ignoredReview.id),
      }),
    ).toMatchObject({ bottleId: null });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, unboundPrice.id),
      }),
    ).toMatchObject({ bottleId: null });
    expect(runReferenceIndex).toHaveBeenNthCalledWith(1, ignoredAlias.name);
    expect(runReferenceIndex).toHaveBeenNthCalledWith(2, unboundAlias.name);
  });

  test("does not propagate a retired Bottle assignment", async ({
    fixtures,
  }) => {
    const retiredBottle = await fixtures.Bottle();
    const replacementBottle = await fixtures.Bottle();
    const reference = await fixtures.BottleReference({
      bottleId: retiredBottle.id,
      name: "Retired Bottle Worker Reference",
    });
    const review = await fixtures.ExternalReview({
      bottleId: null,
      name: reference.name,
    });
    await db.insert(bottleTombstones).values({
      bottleId: retiredBottle.id,
      newBottleId: replacementBottle.id,
    });

    await onBottleReferenceChange({ name: reference.name });

    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, review.id),
      }),
    ).toMatchObject({ bottleId: null });
    expect(runReferenceIndex).toHaveBeenCalledWith(reference.name);
  });

  test("rejects an unknown reference before scheduling indexing", async () => {
    await expect(
      onBottleReferenceChange({ name: "Unknown Bottle Reference" }),
    ).rejects.toThrow("Unknown bottle reference: Unknown Bottle Reference");
    expect(runReferenceIndex).not.toHaveBeenCalled();
  });
});
