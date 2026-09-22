import { db } from "@peated/server/db";
import { reports } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("POST /reports", () => {
  test("requires auth", async () => {
    const err = await waitError(() =>
      routerClient.reports.create({
        objectType: "tasting",
        objectId: 1,
        reason: "spam",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("reports a tasting and records the tasting's author", async ({
    defaults,
    fixtures,
  }) => {
    const author = await fixtures.User();
    const tasting = await fixtures.Tasting({ createdById: author.id });

    const report = await routerClient.reports.create(
      {
        objectType: "tasting",
        objectId: tasting.id,
        reason: "harassment",
        comment: "This is targeted at me.",
      },
      { context: { user: defaults.user } },
    );

    expect(report).toMatchObject({
      objectType: "tasting",
      objectId: tasting.id,
      reason: "harassment",
      comment: "This is targeted at me.",
      status: "open",
    });
    const [saved] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, report.id));
    expect(saved.reportedUserId).toBe(author.id);
    expect(saved.createdById).toBe(defaults.user.id);
  });

  test("reports a comment, a member review, and a member", async ({
    defaults,
    fixtures,
  }) => {
    const author = await fixtures.User();
    const comment = await fixtures.Comment({ createdById: author.id });
    const bottle = await fixtures.Bottle();
    const review = await routerClient.memberReviews.save(
      { bottle: bottle.id, notes: "Rude words.", score: 10 },
      { context: { user: author } },
    );

    for (const target of [
      { objectType: "comment" as const, objectId: comment.id },
      { objectType: "member_review" as const, objectId: review.id },
      { objectType: "user" as const, objectId: author.id },
    ]) {
      const report = await routerClient.reports.create(
        { ...target, reason: "other" },
        { context: { user: defaults.user } },
      );
      const [saved] = await db
        .select()
        .from(reports)
        .where(eq(reports.id, report.id));
      expect(saved.reportedUserId).toBe(author.id);
    }
  });

  test("returns the existing open report instead of a duplicate", async ({
    defaults,
    fixtures,
  }) => {
    const tasting = await fixtures.Tasting();
    const first = await routerClient.reports.create(
      { objectType: "tasting", objectId: tasting.id, reason: "spam" },
      { context: { user: defaults.user } },
    );
    const second = await routerClient.reports.create(
      { objectType: "tasting", objectId: tasting.id, reason: "hate" },
      { context: { user: defaults.user } },
    );

    expect(second.id).toBe(first.id);
    expect(second.reason).toBe("spam");
    const rows = await db
      .select()
      .from(reports)
      .where(eq(reports.createdById, defaults.user.id));
    expect(rows).toHaveLength(1);
  });

  test("rejects reporting your own content", async ({ defaults, fixtures }) => {
    const tasting = await fixtures.Tasting({ createdById: defaults.user.id });
    const err = await waitError(() =>
      routerClient.reports.create(
        { objectType: "tasting", objectId: tasting.id, reason: "spam" },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: You cannot report your own content.]`,
    );
  });

  test("rejects missing or removed content", async ({ defaults, fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const tasting = await fixtures.Tasting();
    await routerClient.admin.content.moderate(
      { kind: "tasting", id: tasting.id, removed: true, reason: "Spam." },
      { context: { user: admin } },
    );

    const err = await waitError(() =>
      routerClient.reports.create(
        { objectType: "tasting", objectId: tasting.id, reason: "spam" },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Content not found.]`);
  });
});
