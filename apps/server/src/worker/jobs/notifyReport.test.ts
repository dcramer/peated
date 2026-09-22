import type { sendReportEmail } from "@peated/server/lib/email";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test, vi } from "vitest";
import { notifyReportWith } from "./notifyReport";

const send = () => vi.fn<typeof sendReportEmail>(async () => undefined);

describe("notifyReport", () => {
  test("emails active, verified moderators and admins except the reporter", async ({
    defaults,
    fixtures,
  }) => {
    const author = await fixtures.User({ username: "spammy" });
    const tasting = await fixtures.Tasting({
      createdById: author.id,
      notes: "Buy my pills.",
    });
    const moderator = await fixtures.User({ mod: true, verified: true });
    const admin = await fixtures.User({ admin: true, verified: true });
    await fixtures.User({ mod: true, verified: false });
    await fixtures.User({
      mod: true,
      verified: true,
      suspendedAt: new Date(),
      suspendedById: admin.id,
      suspensionReason: "Testing.",
    });
    await fixtures.User({ verified: true });
    const reportingMod = await fixtures.User({ mod: true, verified: true });

    const report = await routerClient.reports.create(
      {
        objectType: "tasting",
        objectId: tasting.id,
        reason: "spam",
        comment: "Ad for a shop.",
      },
      { context: { user: reportingMod } },
    );

    const sendReport = send();
    await notifyReportWith(report.id, sendReport);

    expect(sendReport).toHaveBeenCalledTimes(1);
    const [call] = sendReport.mock.calls;
    expect([...call[0].to].sort()).toEqual(
      [moderator.email, admin.email].sort(),
    );
    expect(call[0].report).toEqual({
      id: report.id,
      subject: "Tasting by @spammy",
      reasonLabel: "Spam or advertising",
      comment: "Ad for a shop.",
      reporterUsername: reportingMod.username,
      contentPreview: "Buy my pills.",
      contentPath: `/tastings/${tasting.id}`,
    });
    expect(defaults.user.mod).toBe(false);
  });

  test("stays quiet for a report that was already closed", async ({
    defaults,
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true, verified: true });
    const tasting = await fixtures.Tasting();
    const report = await routerClient.reports.create(
      { objectType: "tasting", objectId: tasting.id, reason: "spam" },
      { context: { user: defaults.user } },
    );
    await routerClient.admin.reports.close(
      { report: report.id, status: "dismissed" },
      { context: { user: moderator } },
    );

    const sendReport = send();
    await notifyReportWith(report.id, sendReport);
    await notifyReportWith(report.id + 1000, sendReport);

    expect(sendReport).not.toHaveBeenCalled();
  });
});
