import { db } from "@peated/server/db";
import {
  bottleReferences,
  bottleTombstones,
  externalReviews,
  storePrices,
} from "@peated/server/db/schema";
import {
  assignBottleReferenceInTransaction,
  BottleReferenceBottleNotFoundError,
  BottleReferenceBottleRetiredError,
  BottleReferenceIdentityChangedError,
  ExactBottleReferenceConflictError,
  finalizeBottleReferenceAssignment,
  listUnmatchedBottleReferenceNames,
  reserveExactBottleReferenceInTransaction,
  StaleBottleReferenceReviewIdentityError,
  syncBottleReferenceConsumersForReferenceChange,
} from "@peated/server/lib/bottleReferences";
import { normalizeBottleReferenceKey } from "@peated/server/lib/normalize";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { eq, sql } from "drizzle-orm";
import { beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.mocked(workerClient.pushJob).mockReset();
  vi.mocked(workerClient.pushUniqueJob).mockReset();
});

async function getAlias(name: string) {
  const reference = await db.query.bottleReferences.findFirst({
    where: eq(sql`LOWER(${bottleReferences.name})`, name.toLowerCase()),
  });
  if (!reference) throw new Error("Bottle reference fixture not found.");
  return reference;
}

describe("listUnmatchedBottleReferenceNames", () => {
  test("uses nullable Bottle identity", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    await db.insert(bottleReferences).values([
      {
        name: "Unresolved Reference",
        bottleId: null,
        assignedByActorId: bottle.createdByActorId,
      },
      {
        name: "Resolved Reference",
        bottleId: bottle.id,
        assignedByActorId: bottle.createdByActorId,
      },
      {
        name: "Ignored Unresolved Reference",
        bottleId: null,
        ignored: true,
        assignedByActorId: bottle.createdByActorId,
      },
      {
        name: "Nullable Ignored Unresolved Reference",
        bottleId: null,
        ignored: null,
        assignedByActorId: bottle.createdByActorId,
      },
    ]);

    await expect(
      listUnmatchedBottleReferenceNames({ limit: 100, offset: 0 }),
    ).resolves.toEqual([
      "Nullable Ignored Unresolved Reference",
      "Unresolved Reference",
    ]);
  });
});

describe("exact Bottle reference reservation", () => {
  test("normalizes the name", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const original = await fixtures.BottleReference({
      name: normalizeBottleReferenceKey("Reserved   12-year-old"),
      bottleId: bottle.id,
      assignmentSource: "legacy",
    });

    const result = await db.transaction((tx) =>
      reserveExactBottleReferenceInTransaction(tx, {
        name: "Reserved   12-year-old",
        bottleId: bottle.id,
        assignmentSource: "canonical",
        assignedByActorId: bottle.createdByActorId,
      }),
    );

    expect(result).toEqual({ name: original.name, changed: true });
    expect(await getAlias(original.name)).toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "canonical",
    });
  });

  test("rejects a name already assigned to another Bottle", async ({
    fixtures,
  }) => {
    const existingBottle = await fixtures.Bottle();
    const selectedBottle = await fixtures.Bottle();
    const reference = await fixtures.BottleReference({
      name: "Bottle Identity Collision",
      bottleId: existingBottle.id,
    });

    await expect(
      db.transaction((tx) =>
        reserveExactBottleReferenceInTransaction(tx, {
          name: reference.name,
          bottleId: selectedBottle.id,
          assignmentSource: "canonical",
          assignedByActorId: selectedBottle.createdByActorId,
        }),
      ),
    ).rejects.toMatchObject({
      name: "ExactBottleReferenceConflictError",
      code: "another_bottle",
      conflictingBottleId: existingBottle.id,
    });
  });

  test("rejects every inactive Bottle state", async ({ fixtures }) => {
    const retired = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const unassigned = await fixtures.LegacyBottle();
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });

    await expect(
      db.transaction((tx) =>
        reserveExactBottleReferenceInTransaction(tx, {
          name: "Retired Bottle Reference",
          bottleId: retired.id,
          assignmentSource: "canonical",
          assignedByActorId: retired.createdByActorId,
        }),
      ),
    ).rejects.toBeInstanceOf(BottleReferenceBottleRetiredError);

    await expect(
      db.transaction((tx) =>
        reserveExactBottleReferenceInTransaction(tx, {
          name: "Unassigned Bottle Reference",
          bottleId: unassigned.id,
          assignmentSource: "canonical",
          assignedByActorId: unassigned.createdByActorId,
        }),
      ),
    ).rejects.toMatchObject({
      name: "BottleReferenceBottleInactiveError",
      reason: "unassigned",
      message: `Bottle ${unassigned.id} is not assigned to a BottleGroup.`,
    });

    await expect(
      db.transaction((tx) =>
        reserveExactBottleReferenceInTransaction(tx, {
          name: "Missing Bottle Reference",
          bottleId: 2_147_483_647,
          assignmentSource: "canonical",
          assignedByActorId: retired.createdByActorId,
        }),
      ),
    ).rejects.toBeInstanceOf(BottleReferenceBottleNotFoundError);

    await expect(
      db
        .select({ name: bottleReferences.name })
        .from(bottleReferences)
        .where(
          sql`${bottleReferences.name} IN ('Retired Bottle Reference', 'Unassigned Bottle Reference', 'Missing Bottle Reference')`,
        ),
    ).resolves.toEqual([]);
  });
});

describe("assignBottleReferenceInTransaction", () => {
  test("writes one Bottle id and clears its stale vector", async ({
    fixtures,
  }) => {
    const selected = await fixtures.Bottle();
    const legacy = await fixtures.Bottle();
    const alreadyAssigned = await fixtures.Bottle();
    const name = "Shared Retailer Bottle Name";
    await db.insert(bottleReferences).values({
      name,
      bottleId: null,
      embedding: Array.from({ length: 3072 }, () => 0.125),
      assignedByActorId: legacy.createdByActorId,
    });
    const price = await fixtures.StorePrice({
      name,
      bottleId: null,
      volume: 750,
    });
    const review = await fixtures.ExternalReview({
      name,
      bottleId: null,
    });
    const assignedPrice = await fixtures.StorePrice({
      name,
      bottleId: alreadyAssigned.id,
      volume: 700,
    });
    const assignedReview = await fixtures.ExternalReview({
      name,
      bottleId: alreadyAssigned.id,
      issue: "Second issue",
    });

    const result = await db.transaction((tx) =>
      assignBottleReferenceInTransaction(tx, {
        bottleId: selected.id,
        name,
        assignmentSource: "human_approved",
        assignedByActorId: selected.createdByActorId,
      }),
    );

    expect(result).toMatchObject({
      bottleId: selected.id,
      referenceChanged: true,
      isNew: false,
    });
    expect(result.reference).not.toHaveProperty("releaseId");
    expect(await getAlias(name)).toMatchObject({
      bottleId: selected.id,
      assignmentSource: "human_approved",
      embedding: null,
    });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, assignedPrice.id),
      }),
    ).toMatchObject({ bottleId: alreadyAssigned.id });
    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, assignedReview.id),
      }),
    ).toMatchObject({ bottleId: alreadyAssigned.id });
  });

  test("retargets only an explicitly snapshotted Review", async ({
    fixtures,
  }) => {
    const previous = await fixtures.Bottle();
    const selected = await fixtures.Bottle();
    const name = "Reviewed Direct Assignment";
    const selectedReview = await fixtures.ExternalReview({
      name,
      bottleId: previous.id,
    });
    const otherReview = await fixtures.ExternalReview({
      name,
      bottleId: previous.id,
      issue: "Other issue",
    });

    await db.transaction((tx) =>
      assignBottleReferenceInTransaction(tx, {
        bottleId: selected.id,
        name,
        assignedByActorId: selected.createdByActorId,
        expectedReview: selectedReview,
      }),
    );

    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, selectedReview.id),
      }),
    ).toMatchObject({ bottleId: selected.id });
    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, otherReview.id),
      }),
    ).toMatchObject({ bottleId: previous.id });
  });

  test("rolls back when the expected Review identity is stale", async ({
    fixtures,
  }) => {
    const previous = await fixtures.Bottle();
    const concurrent = await fixtures.Bottle();
    const selected = await fixtures.Bottle();
    const review = await fixtures.ExternalReview({
      name: "Concurrent Review Reference",
      bottleId: previous.id,
    });
    await db
      .update(externalReviews)
      .set({ bottleId: concurrent.id })
      .where(eq(externalReviews.id, review.id));

    await expect(
      db.transaction((tx) =>
        assignBottleReferenceInTransaction(tx, {
          bottleId: selected.id,
          name: review.name,
          assignedByActorId: selected.createdByActorId,
          expectedReview: review,
        }),
      ),
    ).rejects.toBeInstanceOf(StaleBottleReferenceReviewIdentityError);
    expect(
      await db.query.bottleReferences.findFirst({
        where: eq(bottleReferences.name, review.name),
      }),
    ).toBeUndefined();
  });

  test("rolls back when a distinct source reference identity changes", async ({
    fixtures,
  }) => {
    for (const field of [
      "bottleId",
      "name",
      "ignored",
      "assignmentSource",
      "assignedByActorId",
    ] as const) {
      const bottle = await fixtures.Bottle();
      const concurrent = await fixtures.Bottle();
      const source = await fixtures.BottleReference({
        name: `Raw Source Reference ${field}`,
        bottleId: null,
      });
      if (field === "bottleId") {
        await db
          .update(bottleReferences)
          .set({ bottleId: concurrent.id })
          .where(eq(bottleReferences.name, source.name));
      } else if (field === "name") {
        await db
          .update(bottleReferences)
          .set({ name: `${source.name} changed` })
          .where(eq(bottleReferences.name, source.name));
      } else if (field === "ignored") {
        await db
          .update(bottleReferences)
          .set({ ignored: !source.ignored })
          .where(eq(bottleReferences.name, source.name));
      } else if (field === "assignmentSource") {
        await db
          .update(bottleReferences)
          .set({ assignmentSource: "human_approved" })
          .where(eq(bottleReferences.name, source.name));
      } else {
        await db
          .update(bottleReferences)
          .set({ assignedByActorId: concurrent.createdByActorId })
          .where(eq(bottleReferences.name, source.name));
      }

      const assignedName = `Normalized Source Reference ${field}`;
      await expect(
        db.transaction((tx) =>
          assignBottleReferenceInTransaction(tx, {
            bottleId: bottle.id,
            name: assignedName,
            assignedByActorId: bottle.createdByActorId,
            sourceReferenceIdentity: source,
          }),
        ),
      ).rejects.toBeInstanceOf(BottleReferenceIdentityChangedError);
      expect(
        await db.query.bottleReferences.findFirst({
          where: eq(bottleReferences.name, assignedName),
        }),
      ).toBeUndefined();
    }
  });

  test("allows concurrent assignments that converge on the same reference identity", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const source = await fixtures.BottleReference({
      name: "Concurrent Source Reference",
      bottleId: bottle.id,
      assignmentSource: "source_approved",
    });
    expect(source.assignedByActorId).not.toBe(bottle.createdByActorId);

    const results = await Promise.all(
      [1, 2].map(() =>
        db.transaction((tx) =>
          assignBottleReferenceInTransaction(tx, {
            bottleId: bottle.id,
            name: source.name,
            assignmentSource: "source_approved",
            assignedByActorId: bottle.createdByActorId,
            sourceReferenceIdentity: source,
          }),
        ),
      ),
    );

    expect(results).toHaveLength(2);
    expect(await getAlias(source.name)).toMatchObject({
      bottleId: bottle.id,
      assignmentSource: "source_approved",
      assignedByActorId: bottle.createdByActorId,
    });
  });

  test("allows one winner when Bottles race to claim the same reference", async ({
    fixtures,
  }) => {
    const first = await fixtures.Bottle();
    const second = await fixtures.Bottle();
    const name = "Concurrent Direct Reference";
    const price = await fixtures.StorePrice({ name, bottleId: null });

    const outcomes = await Promise.allSettled(
      [first, second].map((bottle) =>
        db.transaction((tx) =>
          assignBottleReferenceInTransaction(tx, {
            bottleId: bottle.id,
            name,
            assignedByActorId: bottle.createdByActorId,
          }),
        ),
      ),
    );

    const fulfilled = outcomes.filter(
      (outcome) => outcome.status === "fulfilled",
    );
    const rejected = outcomes.filter(
      (outcome) => outcome.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(
      ExactBottleReferenceConflictError,
    );

    const winnerBottleId = fulfilled[0]!.value.bottleId;
    expect(await getAlias(name)).toMatchObject({ bottleId: winnerBottleId });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: winnerBottleId });
  });

  test("scopes propagation by site and volume", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const otherSite = await fixtures.ExternalSiteOrExisting({
      type: "astorwines",
    });
    const name = "Scoped Retailer Reference";
    const matchingPrice = await fixtures.StorePrice({
      name,
      bottleId: null,
      externalSiteId: site.id,
      volume: 750,
    });
    const otherVolume = await fixtures.StorePrice({
      name,
      bottleId: null,
      externalSiteId: site.id,
      volume: 700,
    });
    const matchingReview = await fixtures.ExternalReview({
      name,
      bottleId: null,
      externalSiteId: site.id,
    });
    const otherReview = await fixtures.ExternalReview({
      name,
      bottleId: null,
      externalSiteId: otherSite.id,
    });

    await db.transaction((tx) =>
      assignBottleReferenceInTransaction(tx, {
        bottleId: bottle.id,
        name,
        externalSiteId: site.id,
        volume: 750,
        assignedByActorId: bottle.createdByActorId,
      }),
    );

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, matchingPrice.id),
      }),
    ).toMatchObject({ bottleId: bottle.id });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, otherVolume.id),
      }),
    ).toMatchObject({ bottleId: null });
    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, matchingReview.id),
      }),
    ).toMatchObject({ bottleId: bottle.id });
    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, otherReview.id),
      }),
    ).toMatchObject({ bottleId: null });
  });

  test("rejects blank aliases without mutating matching consumers", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({ name: "   ", bottleId: null });

    await expect(
      db.transaction((tx) =>
        assignBottleReferenceInTransaction(tx, {
          bottleId: bottle.id,
          name: "   ",
          assignedByActorId: bottle.createdByActorId,
        }),
      ),
    ).rejects.toMatchObject({ name: "FailedToSaveBottleReferenceError" });
    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: null });
  });
});

describe("reference replay", () => {
  test("replays direct Bottle identity without overwriting assigned consumers", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const reference = await fixtures.BottleReference({
      name: "Replay Direct Bottle Reference",
      bottleId: bottle.id,
    });
    const price = await fixtures.StorePrice({
      name: reference.name,
      bottleId: null,
    });
    const assignedReview = await fixtures.ExternalReview({
      name: reference.name,
      bottleId: otherBottle.id,
    });

    await syncBottleReferenceConsumersForReferenceChange(reference.name);

    expect(
      await db.query.storePrices.findFirst({
        where: eq(storePrices.id, price.id),
      }),
    ).toMatchObject({ bottleId: bottle.id });
    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, assignedReview.id),
      }),
    ).toMatchObject({ bottleId: otherBottle.id });
  });

  test("replays an active reference with nullable snapshot state", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const reference = await fixtures.BottleReference({
      name: "Nullable Snapshot Replay Reference",
      bottleId: bottle.id,
      ignored: null,
    });
    const review = await fixtures.ExternalReview({
      name: reference.name,
      bottleId: null,
    });

    await syncBottleReferenceConsumersForReferenceChange(reference.name);

    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, review.id),
      }),
    ).toMatchObject({ bottleId: bottle.id });
  });

  test("does not replay ignored, unbound, or retired aliases", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const ignoredAlias = await fixtures.BottleReference({
      name: "Ignored Replay Reference",
      bottleId: bottle.id,
      ignored: true,
    });
    const unboundAlias = await fixtures.BottleReference({
      name: "Unbound Replay Reference",
      bottleId: null,
    });
    const retiredAlias = await fixtures.BottleReference({
      name: "Retired Replay Reference",
      bottleId: bottle.id,
    });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: replacement.id,
    });
    const prices = await Promise.all(
      [ignoredAlias, unboundAlias, retiredAlias].map((reference) =>
        fixtures.StorePrice({
          name: reference.name,
          bottleId: null,
        }),
      ),
    );

    for (const reference of [ignoredAlias, unboundAlias, retiredAlias]) {
      await syncBottleReferenceConsumersForReferenceChange(reference.name);
    }

    for (const price of prices) {
      expect(
        await db.query.storePrices.findFirst({
          where: eq(storePrices.id, price.id),
        }),
      ).toMatchObject({ bottleId: null });
    }
  });
});

describe("finalizeBottleReferenceAssignment", () => {
  test("applies a price image and indexes the direct Bottle", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ imageUrl: null });
    const imageUrl = "https://example.com/direct-bottle.jpg";
    const price = await fixtures.StorePrice({
      bottleId: null,
      name: "Direct Bottle Image",
      imageUrl,
    });
    const result = await db.transaction((tx) =>
      assignBottleReferenceInTransaction(tx, {
        bottleId: bottle.id,
        name: price.name,
        externalSiteId: price.externalSiteId,
        volume: price.volume,
        assignedByActorId: bottle.createdByActorId,
      }),
    );

    await finalizeBottleReferenceAssignment(result);

    expect(
      await db.query.bottles.findFirst({
        where: (bottles, { eq }) => eq(bottles.id, bottle.id),
      }),
    ).toMatchObject({ imageUrl });
    expect(workerClient.pushJob).toHaveBeenCalledWith("IndexBottleReference", {
      name: result.reference.name,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSearchVectors",
      { bottleId: bottle.id },
    );
  });

  test("treats queue failures as nonfatal post-commit effects", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const result = await db.transaction((tx) =>
      assignBottleReferenceInTransaction(tx, {
        bottleId: bottle.id,
        name: "Queue Failure Reference",
        assignedByActorId: bottle.createdByActorId,
      }),
    );
    vi.mocked(workerClient.pushJob).mockRejectedValueOnce(
      new Error("Queue unavailable"),
    );
    vi.mocked(workerClient.pushUniqueJob).mockRejectedValueOnce(
      new Error("Queue unavailable"),
    );

    await expect(
      finalizeBottleReferenceAssignment(result),
    ).resolves.toBeUndefined();
    expect(await getAlias(result.reference.name)).toMatchObject({
      bottleId: bottle.id,
    });
  });
});
