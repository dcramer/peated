import { db } from "@peated/server/db";
import {
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

type StorePriceFixtureFactory = (
  data?: Partial<{
    bottleId: null | number;
    hidden: boolean;
    imageUrl: null | string;
    name: string;
    updatedAt: Date;
    url: string;
  }>,
) => Promise<{ id: number }>;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysAgoAt(days: number, hour: number): Date {
  const date = startOfDay(new Date());
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);

  return date;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function createProposalFixture(
  {
    createdAt,
    enteredQueueAt = null,
    hidden = false,
    processingExpiresAt = null,
    status,
  }: {
    createdAt: Date;
    enteredQueueAt?: Date | null;
    hidden?: boolean;
    processingExpiresAt?: Date | null;
    status: "approved" | "errored" | "ignored" | "pending_review";
  },
  {
    bottleId,
    storePrice,
  }: {
    bottleId: number;
    storePrice: StorePriceFixtureFactory;
  },
) {
  const price = await storePrice({
    bottleId: status === "approved" ? bottleId : null,
    hidden,
    imageUrl: null,
    name: `Fixture ${Math.random().toString(36).slice(2)}`,
    updatedAt: createdAt,
    url: `https://example.com/${Math.random().toString(36).slice(2)}`,
  });

  await db
    .update(storePrices)
    .set({
      createdAt,
      updatedAt: createdAt,
    })
    .where(eq(storePrices.id, price.id));

  await db.insert(storePriceMatchProposals).values({
    priceId: price.id,
    status,
    proposalType: "match_existing",
    createdAt,
    updatedAt: createdAt,
    enteredQueueAt,
    processingExpiresAt,
  });
}

describe("GET /admin/review-workbench/stats", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.admin.reviewWorkbenchStats(),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires admin privileges", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.admin.reviewWorkbenchStats(undefined, {
        context: { user },
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns daily cohort stats and backlog aging", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();

    const todayAutoResolvedAt = daysAgoAt(0, 8);
    const todayAutoIgnoredAt = daysAgoAt(0, 9);
    const todayQueueApprovedAt = daysAgoAt(0, 10);
    const todayQueueOpenAt = daysAgoAt(0, 11);
    const todayQueueErroredAt = daysAgoAt(0, 12);
    const todayQueueProcessingAt = daysAgoAt(0, 13);
    const yesterdayQueueIgnoredAt = daysAgoAt(1, 15);

    await createProposalFixture(
      {
        createdAt: todayAutoResolvedAt,
        status: "approved",
      },
      { bottleId: bottle.id, storePrice: fixtures.StorePrice },
    );
    await createProposalFixture(
      {
        createdAt: todayAutoIgnoredAt,
        status: "ignored",
      },
      { bottleId: bottle.id, storePrice: fixtures.StorePrice },
    );
    await createProposalFixture(
      {
        createdAt: todayQueueApprovedAt,
        enteredQueueAt: daysAgoAt(0, 10),
        status: "approved",
      },
      { bottleId: bottle.id, storePrice: fixtures.StorePrice },
    );
    await createProposalFixture(
      {
        createdAt: todayQueueOpenAt,
        enteredQueueAt: daysAgoAt(2, 9),
        status: "pending_review",
      },
      { bottleId: bottle.id, storePrice: fixtures.StorePrice },
    );
    await createProposalFixture(
      {
        createdAt: todayQueueErroredAt,
        enteredQueueAt: daysAgoAt(4, 9),
        status: "errored",
      },
      { bottleId: bottle.id, storePrice: fixtures.StorePrice },
    );
    await createProposalFixture(
      {
        createdAt: todayQueueProcessingAt,
        enteredQueueAt: daysAgoAt(0, 13),
        processingExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        status: "pending_review",
      },
      { bottleId: bottle.id, storePrice: fixtures.StorePrice },
    );
    await createProposalFixture(
      {
        createdAt: yesterdayQueueIgnoredAt,
        enteredQueueAt: daysAgoAt(1, 15),
        status: "ignored",
      },
      { bottleId: bottle.id, storePrice: fixtures.StorePrice },
    );

    const result = await routerClient.admin.reviewWorkbenchStats(undefined, {
      context: { user },
    });

    expect(result.windowDays).toBe(14);
    expect(result.daily).toHaveLength(14);
    expect(result.snapshot.today).toMatchObject({
      date: toDateKey(startOfDay(new Date())),
      newListings: 6,
      matchedSuccessfully: 2,
      autoResolved: 1,
      autoIgnored: 1,
      sentToQueue: 4,
      queueApproved: 1,
      queueIgnored: 0,
      queueOpen: 2,
      queueErrored: 1,
    });
    expect(result.daily[1]).toMatchObject({
      date: toDateKey(daysAgoAt(1, 0)),
      newListings: 1,
      matchedSuccessfully: 0,
      autoResolved: 0,
      autoIgnored: 0,
      sentToQueue: 1,
      queueApproved: 0,
      queueIgnored: 1,
      queueOpen: 0,
      queueErrored: 0,
    });
    expect(result.snapshot.backlog).toMatchObject({
      actionable: 2,
      processing: 1,
      errored: 1,
      olderThan24Hours: 2,
      olderThan72Hours: 1,
    });
    expect(result.snapshot.backlog.oldestHours).not.toBeNull();
    expect(result.snapshot.backlog.oldestHours!).toBeGreaterThanOrEqual(95);
  });
});
