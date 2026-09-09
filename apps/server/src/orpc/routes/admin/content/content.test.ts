import { db } from "@peated/server/db";
import {
  externalReviewBodies,
  externalReviews,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("admin content moderation", () => {
  test("requires an administrator", async ({ defaults }) => {
    const error = await waitError(
      routerClient.admin.content.list(
        { kind: "tasting" },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("shows full member content, including private member content", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const member = await fixtures.User({ private: true });
    const bottle = await fixtures.Bottle();
    const review = await routerClient.memberReviews.save(
      { bottle: bottle.id, notes: "Private review notes.", score: 91 },
      { context: { user: member } },
    );
    const result = await routerClient.admin.content.list(
      { kind: "member_review", query: member.username },
      { context: { user: admin } },
    );

    expect(result.results).toEqual([
      expect.objectContaining({
        id: review.id,
        kind: "member_review",
        member: expect.objectContaining({ private: true }),
        notes: "Private review notes.",
      }),
    ]);
  });

  test("does not return stored critic review bodies", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const review = await fixtures.ExternalReview({
      clip: "A short source clip.",
      name: "Critic review",
    });
    await db.insert(externalReviewBodies).values({
      externalReviewId: review.id,
      body: "Full licensed source text that must stay internal.",
      fetchedAt: new Date(),
    });

    const result = await routerClient.admin.content.details(
      { id: review.id, kind: "external_review" },
      { context: { user: admin } },
    );

    expect(result).toMatchObject({
      clip: "A short source clip.",
      kind: "external_review",
    });
    expect(JSON.stringify(result)).not.toContain("Full licensed source text");
  });

  test("uses identity search and stable newest-first paging", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const member = await fixtures.User();
    const bottle = await fixtures.Bottle({ name: "Searchable Bottle" });
    const older = await fixtures.Tasting({
      bottleId: bottle.id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      createdById: member.id,
      notes: "Secret content phrase",
    });
    const newer = await fixtures.Tasting({
      bottleId: bottle.id,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      createdById: member.id,
    });

    const first = await routerClient.admin.content.list(
      { kind: "tasting", limit: 1, query: member.username },
      { context: { user: admin } },
    );
    const second = await routerClient.admin.content.list(
      { cursor: 2, kind: "tasting", limit: 1, query: member.username },
      { context: { user: admin } },
    );
    const contentSearch = await routerClient.admin.content.list(
      { kind: "tasting", query: "Secret content phrase" },
      { context: { user: admin } },
    );

    expect(first.results.map(({ id }) => id)).toEqual([newer.id]);
    expect(first.rel).toEqual({ nextCursor: 2, prevCursor: null });
    expect(second.results.map(({ id }) => id)).toEqual([older.id]);
    expect(second.rel).toEqual({ nextCursor: null, prevCursor: 1 });
    expect(contentSearch.results).toEqual([]);
  });

  test("validates moderation reasons and missing records", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });

    const invalidReason = await waitError(
      routerClient.admin.content.moderate(
        { id: 1, kind: "tasting", reason: " ", removed: true },
        { context: { user: admin } },
      ),
    );
    const missing = await waitError(
      routerClient.admin.content.moderate(
        { id: 999_999, kind: "tasting", reason: "Spam.", removed: true },
        { context: { user: admin } },
      ),
    );

    expect(invalidReason).toMatchObject({ code: "BAD_REQUEST" });
    expect(missing).toMatchObject({ code: "NOT_FOUND" });
  });

  test("removes and restores a member review without losing it", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const member = await fixtures.User();
    const bottle = await fixtures.Bottle();
    const review = await routerClient.memberReviews.save(
      { bottle: bottle.id, notes: "Keep this record.", score: 87 },
      { context: { user: member } },
    );
    workerClient.pushJob.mockClear();

    const removed = await routerClient.admin.content.moderate(
      {
        id: review.id,
        kind: "member_review",
        reason: "Contains personal information.",
        removed: true,
      },
      { context: { user: admin } },
    );
    const repeated = await routerClient.admin.content.moderate(
      {
        id: review.id,
        kind: "member_review",
        reason: "Repeated request should not add history.",
        removed: true,
      },
      { context: { user: admin } },
    );

    expect(removed.moderation).toMatchObject({
      reason: "Contains personal information.",
      removed: true,
    });
    expect(removed.moderation.removedBy?.displayName).toBe(admin.username);
    expect(repeated.history).toHaveLength(1);
    expect(workerClient.pushJob).toHaveBeenCalledTimes(1);
    await expect(
      routerClient.memberReviews.details({ review: review.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      (
        await routerClient.memberReviews.list({ bottle: bottle.id })
      ).results.map(({ id }) => id),
    ).not.toContain(review.id);
    expect(
      (
        await routerClient.admin.content.list(
          { kind: "member_review", status: "removed" },
          { context: { user: admin } },
        )
      ).results.map(({ id }) => id),
    ).toContain(review.id);

    const restored = await routerClient.admin.content.moderate(
      {
        id: review.id,
        kind: "member_review",
        reason: "Personal information was removed from the notes.",
        removed: false,
      },
      { context: { user: admin } },
    );

    expect(restored.moderation.removed).toBe(false);
    expect(restored.history.map(({ action }) => action)).toEqual([
      "restore",
      "remove",
    ]);
    expect(workerClient.pushJob).toHaveBeenCalledTimes(2);
    await expect(
      routerClient.memberReviews.details({ review: review.id }),
    ).resolves.toMatchObject({ id: review.id, notes: "Keep this record." });
  });

  test("hides removed tastings and rejects new interactions", async ({
    defaults,
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const author = await fixtures.User();
    const tasting = await fixtures.Tasting({
      createdById: author.id,
      notes: "Moderate this tasting.",
    });

    await routerClient.admin.content.moderate(
      {
        id: tasting.id,
        kind: "tasting",
        reason: "Spam.",
        removed: true,
      },
      { context: { user: admin } },
    );

    await expect(
      routerClient.tastings.details({ tasting: tasting.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      (await routerClient.tastings.list()).results.map(({ id }) => id),
    ).not.toContain(tasting.id);
    await expect(
      routerClient.comments.create(
        {
          comment: "This should fail.",
          createdAt: new Date().toISOString(),
          tasting: tasting.id,
        },
        { context: { user: defaults.user } },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      routerClient.toasts.create(
        { tasting: tasting.id },
        { context: { user: defaults.user } },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      routerClient.tastings.delete(
        { tasting: tasting.id },
        { context: { user: author } },
      ),
    ).resolves.toEqual({});
  });

  test("keeps a critic review removed when source visibility changes", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSite();
    await fixtures.ApprovedExternalReviewPublication({
      externalSiteId: site.id,
    });
    const review = await fixtures.ExternalReview({
      bottleId: bottle.id,
      externalSiteId: site.id,
      hidden: false,
    });

    expect(
      (
        await routerClient.externalReviews.list({
          bottle: bottle.id,
          sort: "name",
        })
      ).results.map(({ id }) => id),
    ).toContain(review.id);

    await routerClient.admin.content.moderate(
      {
        id: review.id,
        kind: "external_review",
        reason: "Source asked for removal.",
        removed: true,
      },
      { context: { user: admin } },
    );
    await db
      .update(externalReviews)
      .set({ hidden: true })
      .where(eq(externalReviews.id, review.id));
    await db
      .update(externalReviews)
      .set({ hidden: false })
      .where(eq(externalReviews.id, review.id));

    const detail = await routerClient.admin.content.details(
      { id: review.id, kind: "external_review" },
      { context: { user: admin } },
    );
    expect(detail).toMatchObject({
      hidden: false,
      moderation: { removed: true, reason: "Source asked for removal." },
    });
    expect(
      (
        await routerClient.externalReviews.list({
          bottle: bottle.id,
          sort: "name",
        })
      ).results.map(({ id }) => id),
    ).not.toContain(review.id);
  });
});
