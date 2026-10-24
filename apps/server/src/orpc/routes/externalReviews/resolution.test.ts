import { BottleClassificationResultSchema } from "@peated/bottle-classifier";
import { db } from "@peated/server/db";
import {
  externalReviews,
  incomingBottleDecisionLogs,
} from "@peated/server/db/schema";
import { persistReviewBottleCheck } from "@peated/server/lib/bottleReferenceResolution";
import * as workerDispatch from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

const attemptedAt = new Date("2026-10-16T18:45:00.000Z");

describe("external review resolution", () => {
  test("requires moderator permissions for evidence and rechecks", async ({
    fixtures,
    defaults,
  }) => {
    const review = await fixtures.ExternalReview({ bottleId: null });
    await expect(
      routerClient.externalReviews.resolution(
        { externalReview: review.id },
        { context: { user: defaults.user } },
      ),
    ).rejects.toThrow("Unauthorized.");
    await expect(
      routerClient.externalReviews.recheck(
        {
          reviews: [
            {
              reviewId: review.id,
              name: review.name,
              attemptedAt: attemptedAt.toISOString(),
            },
          ],
        },
        { context: { user: defaults.user } },
      ),
    ).rejects.toThrow("Unauthorized.");
  });

  test("completed unresolved reviews reach the Inbox with saved evidence and leave after assignment", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const site = await fixtures.ExternalSite({ type: "whiskyfun" });
    await fixtures.ApprovedExternalReviewPublication({
      externalSiteId: site.id,
    });
    const review = await fixtures.ExternalReview({
      bottleId: null,
      externalSiteId: site.id,
      hidden: true,
    });
    await db
      .update(externalReviews)
      .set({ bottleNoMatchAt: attemptedAt })
      .where(eq(externalReviews.id, review.id));
    await persistReviewBottleCheck({
      reviewId: review.id,
      classification: {
        input: { reference: { id: review.id, name: review.name } },
        result: BottleClassificationResultSchema.parse({
          status: "ignored",
          reason:
            "Reference is a bundle or multi-bottle listing, not a single bottle listing.",
          artifacts: {
            extractedIdentity: null,
            candidates: [],
            searchEvidence: [],
            resolvedEntities: [],
          },
        }),
      },
    });
    const key = `external_review:${review.id}`;
    const inbox = await routerClient.admin.moderation.listTasks(undefined, {
      context: { user: mod },
    });
    expect(inbox.results).toEqual([
      expect.objectContaining({
        key,
        source: { kind: "external_review", reviewId: review.id },
      }),
    ]);
    await expect(
      routerClient.admin.moderation.task({ key }, { context: { user: mod } }),
    ).resolves.toMatchObject({ task: { key } });
    const item = await routerClient.externalReviews.resolution(
      { externalReview: review.id },
      { context: { user: mod } },
    );
    expect(item.check?.output).toMatchObject({ status: "ignored" });
    const bottle = await fixtures.Bottle();
    await routerClient.externalReviews.update(
      {
        externalReview: review.id,
        bottle: bottle.id,
        expectedResolution: {
          name: review.name,
          attemptedAt: item.attemptedAt!,
        },
      },
      { context: { user: mod } },
    );
    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, review.id),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      bottleNoMatchAt: null,
      hidden: false,
    });
    expect(
      await db.query.incomingBottleDecisionLogs.findFirst({
        where: eq(incomingBottleDecisionLogs.sourceId, review.id),
      }),
    ).toMatchObject({ bottleId: bottle.id, decision: "match" });
    await expect(
      routerClient.admin.moderation.task({ key }, { context: { user: mod } }),
    ).rejects.toThrow("no longer needs attention");
  });

  test("pending, removed and assigned reviews stay out; staged unresolved reviews remain reviewable", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const pending = await fixtures.ExternalReview({ bottleId: null });
    const staged = await fixtures.ExternalReview({
      bottleId: null,
      hidden: true,
    });
    const assigned = await fixtures.ExternalReview();
    await db
      .update(externalReviews)
      .set({ bottleNoMatchAt: attemptedAt })
      .where(eq(externalReviews.id, staged.id));
    await db
      .update(externalReviews)
      .set({ bottleNoMatchAt: attemptedAt })
      .where(eq(externalReviews.id, assigned.id));
    const removed = await fixtures.ExternalReview({ bottleId: null });
    await routerClient.admin.content.moderate(
      {
        kind: "external_review",
        id: removed.id,
        removed: true,
        reason: "Not a whisky review.",
      },
      { context: { user: await fixtures.User({ admin: true }) } },
    );
    await db
      .update(externalReviews)
      .set({ bottleNoMatchAt: attemptedAt })
      .where(eq(externalReviews.id, removed.id));
    const inbox = await routerClient.admin.moderation.listTasks(undefined, {
      context: { user: mod },
    });
    expect(inbox.results.map(({ key }) => key)).toEqual([
      `external_review:${staged.id}`,
    ]);
    await expect(
      routerClient.admin.moderation.task(
        { key: `external_review:${pending.id}` },
        { context: { user: mod } },
      ),
    ).rejects.toThrow("no longer needs attention");
  });

  test("rechecks only explicit versions without hiding unresolved reviews", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const first = await fixtures.ExternalReview({ bottleId: null });
    const second = await fixtures.ExternalReview({ bottleId: null });
    for (const review of [first, second])
      await db
        .update(externalReviews)
        .set({ bottleNoMatchAt: attemptedAt })
        .where(eq(externalReviews.id, review.id));
    const expected = (review: typeof first) => ({
      reviewId: review.id,
      name: review.name,
      attemptedAt: attemptedAt.toISOString(),
    });
    await expect(
      routerClient.externalReviews.recheck(
        {
          reviews: [
            expected(first),
            { ...expected(second), name: "Stale name" },
          ],
        },
        { context: { user: mod } },
      ),
    ).rejects.toThrow("review changed");
    expect(
      (
        await db.query.externalReviews.findFirst({
          where: eq(externalReviews.id, first.id),
        })
      )?.bottleNoMatchAt,
    ).toEqual(attemptedAt);
    await expect(
      routerClient.externalReviews.recheck(
        { reviews: [expected(first)] },
        { context: { user: mod } },
      ),
    ).resolves.toEqual({ queued: [first.id] });
    expect(workerDispatch.pushJob).toHaveBeenCalledWith(
      "CreateMissingBottles",
      {
        reviewId: first.id,
        expectedResolution: {
          name: first.name,
          attemptedAt: attemptedAt.toISOString(),
        },
      },
    );
    expect(
      (
        await db.query.externalReviews.findFirst({
          where: eq(externalReviews.id, first.id),
        })
      )?.bottleNoMatchAt,
    ).toEqual(attemptedAt);
    expect(
      (
        await db.query.externalReviews.findFirst({
          where: eq(externalReviews.id, second.id),
        })
      )?.bottleNoMatchAt,
    ).toEqual(attemptedAt);
    await expect(
      routerClient.externalReviews.update(
        {
          externalReview: first.id,
          bottle: (await fixtures.Bottle()).id,
          expectedResolution: {
            name: first.name,
            attemptedAt: attemptedAt.toISOString(),
          },
        },
        { context: { user: mod } },
      ),
    ).resolves.toMatchObject({ bottle: { id: expect.any(Number) } });
  });

  test("dispatch failures leave unresolved tasks visible without undoing a concurrent assignment", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const first = await fixtures.ExternalReview({ bottleId: null });
    const second = await fixtures.ExternalReview({ bottleId: null });
    const bottle = await fixtures.Bottle();
    for (const review of [first, second])
      await db
        .update(externalReviews)
        .set({ bottleNoMatchAt: attemptedAt })
        .where(eq(externalReviews.id, review.id));
    workerDispatch.pushJob.mockImplementationOnce(async () => {
      await db
        .update(externalReviews)
        .set({ bottleId: bottle.id, bottleNoMatchAt: null })
        .where(eq(externalReviews.id, second.id));
      throw new Error("Queue unavailable");
    });
    await expect(
      routerClient.externalReviews.recheck(
        {
          reviews: [first, second].map((review) => ({
            reviewId: review.id,
            name: review.name,
            attemptedAt: attemptedAt.toISOString(),
          })),
        },
        { context: { user: mod } },
      ),
    ).rejects.toThrow("Queue unavailable");
    expect(
      (
        await db.query.externalReviews.findFirst({
          where: eq(externalReviews.id, first.id),
        })
      )?.bottleNoMatchAt,
    ).toEqual(attemptedAt);
    expect(
      await db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, second.id),
      }),
    ).toMatchObject({ bottleId: bottle.id, bottleNoMatchAt: null });
  });
});
