import { describe, expect, test } from "vitest";

import { isCurrentHref } from "./adminLayout.stylex";

describe("admin navigation", () => {
  test("matches the overview only at the admin root", () => {
    const overview = {
      href: "/admin",
      label: "Overview",
      match: "exact" as const,
    };

    expect(isCurrentHref("/admin", overview)).toBe(true);
    expect(isCurrentHref("/admin/users", overview)).toBe(false);
  });

  test("keeps a section selected on its detail routes", () => {
    const inbox = {
      href: "/admin/moderation/inbox",
      label: "Inbox",
    };

    expect(isCurrentHref("/admin/moderation/inbox/operation/42", inbox)).toBe(
      true,
    );
    expect(isCurrentHref("/admin/moderation/history", inbox)).toBe(false);
  });
});
