import { db } from "@peated/server/db";
import { reports } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("admin reports", () => {
  test("requires a moderator or administrator", async ({
    defaults,
    fixtures,
  }) => {
    const error = await waitError(
      routerClient.admin.reports.list(undefined, {
        context: { user: defaults.user },
      }),
    );
    expect(error).toMatchObject({ code: "UNAUTHORIZED" });

    const moderator = await fixtures.User({ mod: true });
    const result = await routerClient.admin.reports.list(undefined, {
      context: { user: moderator },
    });
    expect(result.results).toEqual([]);
  });

  test("lists open reports with the reporter, the reported member, and the content", async ({
    defaults,
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const author = await fixtures.User({ username: "reported-author" });
    const tasting = await fixtures.Tasting({
      createdById: author.id,
      notes: "Buy my pills.",
    });
    const report = await routerClient.reports.create(
      { objectType: "tasting", objectId: tasting.id, reason: "spam" },
      { context: { user: defaults.user } },
    );

    const { results } = await routerClient.admin.reports.list(undefined, {
      context: { user: moderator },
    });
    expect(results).toEqual([
      expect.objectContaining({
        id: report.id,
        status: "open",
        reason: "spam",
        createdBy: expect.objectContaining({ id: defaults.user.id }),
        reportedUser: expect.objectContaining({
          id: author.id,
          username: "reported-author",
          suspended: false,
        }),
        contentUrl: `/tastings/${tasting.id}`,
        contentPreview: "Buy my pills.",
        openReportCount: 0,
      }),
    ]);

    const details = await routerClient.admin.reports.details(
      { report: report.id },
      { context: { user: moderator } },
    );
    expect(details.id).toBe(report.id);
  });

  test("appears in the moderation inbox and history", async ({
    defaults,
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const author = await fixtures.User({ username: "inbox-author" });
    const comment = await fixtures.Comment({ createdById: author.id });
    const report = await routerClient.reports.create(
      { objectType: "comment", objectId: comment.id, reason: "harassment" },
      { context: { user: defaults.user } },
    );

    const inbox = await routerClient.admin.moderation.listTasks(
      { category: "community" },
      { context: { user: moderator } },
    );
    expect(inbox.counts.community).toBe(1);
    expect(inbox.results).toEqual([
      expect.objectContaining({
        key: `report:${report.id}`,
        kind: "report",
        category: "community",
        title: "Comment by @inbox-author",
        sourceLabel: "Member report",
        statusLabel: "Harassment or bullying",
        source: { kind: "report", reportId: report.id },
      }),
    ]);
    const located = await routerClient.admin.moderation.task(
      { key: `report:${report.id}` },
      { context: { user: moderator } },
    );
    expect(located.task.key).toBe(`report:${report.id}`);

    await routerClient.admin.reports.close(
      { report: report.id, status: "dismissed", note: "Just a disagreement." },
      { context: { user: moderator } },
    );

    const after = await routerClient.admin.moderation.listTasks(
      { category: "community" },
      { context: { user: moderator } },
    );
    expect(after.results).toEqual([]);

    const history = await routerClient.admin.moderation.listHistory(
      { category: "community" },
      { context: { user: moderator } },
    );
    expect(history.results).toEqual([
      expect.objectContaining({
        key: `report:${report.id}`,
        kind: "report",
        title: "Comment by @inbox-author",
        outcome: "dismissed",
        actor: moderator.username,
      }),
    ]);
    const details = await routerClient.admin.moderation.historyDetails(
      { key: `report:${report.id}` },
      { context: { user: moderator } },
    );
    expect(details.note).toBe("Just a disagreement.");
    expect(details.event.outcome).toBe("dismissed");
  });

  test("closing a report closes every open report about the same target", async ({
    defaults,
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const otherReporter = await fixtures.User();
    const tasting = await fixtures.Tasting();
    const first = await routerClient.reports.create(
      { objectType: "tasting", objectId: tasting.id, reason: "spam" },
      { context: { user: defaults.user } },
    );
    const second = await routerClient.reports.create(
      { objectType: "tasting", objectId: tasting.id, reason: "hate" },
      { context: { user: otherReporter } },
    );
    const unrelated = await routerClient.reports.create(
      {
        objectType: "user",
        objectId: otherReporter.id,
        reason: "other",
      },
      { context: { user: defaults.user } },
    );

    const before = await routerClient.admin.reports.details(
      { report: first.id },
      { context: { user: moderator } },
    );
    expect(before.openReportCount).toBe(1);

    const closed = await routerClient.admin.reports.close(
      { report: first.id, status: "resolved", note: "Removed the tasting." },
      { context: { user: moderator } },
    );
    expect(closed).toMatchObject({
      status: "resolved",
      closeNote: "Removed the tasting.",
      closedBy: { id: moderator.id, username: moderator.username },
    });
    expect(closed.closedAt).not.toBeNull();

    const rows = await db.select().from(reports);
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    expect(byId[second.id].status).toBe("resolved");
    expect(byId[second.id].closedById).toBe(moderator.id);
    expect(byId[unrelated.id].status).toBe("open");

    // Closing again changes nothing.
    const again = await routerClient.admin.reports.close(
      { report: first.id, status: "dismissed" },
      { context: { user: moderator } },
    );
    expect(again.status).toBe("resolved");
  });

  test("keeps a closed report readable after the content is gone", async ({
    defaults,
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const comment = await fixtures.Comment();
    const report = await routerClient.reports.create(
      { objectType: "comment", objectId: comment.id, reason: "spam" },
      { context: { user: defaults.user } },
    );
    await routerClient.comments.delete(
      { comment: comment.id },
      { context: { user: moderator } },
    );

    const details = await routerClient.admin.reports.details(
      { report: report.id },
      { context: { user: moderator } },
    );
    expect(details.contentUrl).toBeNull();
    expect(details.contentPreview).toBeNull();
    expect(details.reportedUser.id).toBe(comment.createdById);
  });
});
