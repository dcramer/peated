import type { User } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ProfileAdminLinks } from "./profileDropdown";

const moderator = {
  id: 1,
  username: "moderator",
  pictureUrl: null,
  private: false,
  mod: true,
} satisfies User;
const admin = { ...moderator, admin: true, mod: false } satisfies User;

describe("ProfileDropdown", () => {
  test("does not show the admin Audits page to moderators", () => {
    const html = renderToStaticMarkup(<ProfileAdminLinks user={moderator} />);

    expect(html).not.toContain("Audits");
    expect(html).not.toContain('href="/admin"');
  });

  test("keeps Audits available to administrators", () => {
    const html = renderToStaticMarkup(<ProfileAdminLinks user={admin} />);

    expect(html).toContain('href="/admin/moderation/inbox"');
    expect(html).toContain('href="/admin"');
  });
});
