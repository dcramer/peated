import { db } from "@peated/server/db";
import { externalReviews } from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import { pushJob } from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("POST /external-reviews/match-pending", () => {
  test("requires a moderator", async ({ defaults }) => {
    await expect(
      routerClient.externalReviews.matchPending(
        {},
        { context: { user: defaults.user } },
      ),
    ).rejects.toThrow("Unauthorized.");
  });

  test("queues only reviews with no Bottle and no completed attempt", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const pending = await fixtures.ExternalReview({ bottleId: null });
    await fixtures.ExternalReview();
    const attempted = await fixtures.ExternalReview({ bottleId: null });
    const removed = await fixtures.ExternalReview({ bottleId: null });
    await db
      .update(externalReviews)
      .set({ bottleNoMatchAt: new Date() })
      .where(eq(externalReviews.id, attempted.id));
    await db
      .update(externalReviews)
      .set({
        removalReason: "Removed by moderator",
        removedAt: new Date(),
        removedByActorId: (await getUserActorForDatabase(db, mod)).id,
      })
      .where(eq(externalReviews.id, removed.id));
    pushJob.mockClear();

    const result = await routerClient.externalReviews.matchPending(
      {},
      { context: { user: mod } },
    );

    expect(result).toEqual({ queued: [pending.id], nextAfterId: null });
    expect(pushJob.mock.calls).toEqual([
      ["CreateMissingBottles", { reviewId: pending.id }],
    ]);
  });

  test("pages by review ID", async ({ fixtures }) => {
    const mod = await fixtures.User({ mod: true });
    const first = await fixtures.ExternalReview({ bottleId: null });
    const second = await fixtures.ExternalReview({ bottleId: null });

    await expect(
      routerClient.externalReviews.matchPending(
        { limit: 1 },
        { context: { user: mod } },
      ),
    ).resolves.toEqual({ queued: [first.id], nextAfterId: first.id });
    await expect(
      routerClient.externalReviews.matchPending(
        { afterId: first.id, limit: 1 },
        { context: { user: mod } },
      ),
    ).resolves.toEqual({ queued: [second.id], nextAfterId: null });
  });
});
