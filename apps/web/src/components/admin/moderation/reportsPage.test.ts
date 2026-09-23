import { describe, expect, test } from "vitest";

import { reportAdminHref } from "./reportsPage.stylex";

describe("reportAdminHref", () => {
  test("sends an open report to its Inbox task", () => {
    expect(reportAdminHref({ id: 12, status: "open" })).toBe(
      "/admin/moderation/inbox/report/12",
    );
  });

  test("sends a closed report to its History entry", () => {
    expect(reportAdminHref({ id: 12, status: "resolved" })).toBe(
      "/admin/moderation/history/report/12",
    );
    expect(reportAdminHref({ id: 12, status: "dismissed" })).toBe(
      "/admin/moderation/history/report/12",
    );
  });
});
