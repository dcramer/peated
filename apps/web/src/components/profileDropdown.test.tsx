import type { User } from "@peated/server/types";
import { AuthProvider } from "@peated/web/hooks/useAuth";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { ProfileDropdown } from "./profileDropdown";

vi.mock("./userAvatar", () => ({
  default: () => <span>User avatar</span>,
}));

vi.mock("@headlessui/react", () => ({
  Menu: ({
    children,
    className,
  }: {
    children: (state: { open: boolean }) => ReactNode;
    className?: string;
  }) => <div className={className}>{children({ open: true })}</div>,
  MenuButton: ({ children }: { children: ReactNode }) => (
    <button>{children}</button>
  ),
  MenuItem: ({ children }: { children: ReactNode }) => <>{children}</>,
  MenuItems: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Transition: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const moderator = {
  id: 1,
  username: "moderator",
  pictureUrl: null,
  private: false,
  mod: true,
} satisfies User;
const admin = { ...moderator, admin: true, mod: false } satisfies User;

describe("ProfileDropdown", () => {
  test("keeps Bottle Checks available in the mobile moderator menu", () => {
    const html = renderToStaticMarkup(
      <AuthProvider user={moderator}>
        <ProfileDropdown />
      </AuthProvider>,
    );

    expect(html).not.toContain("hidden sm:block");
    expect(html).toContain('href="/bottle-checks"');
    expect(html).toContain("Bottle Checks");
  });

  test("keeps Bottle Checks available to administrators", () => {
    const html = renderToStaticMarkup(
      <AuthProvider user={admin}>
        <ProfileDropdown />
      </AuthProvider>,
    );

    expect(html).toContain('href="/bottle-checks"');
    expect(html).toContain('href="/admin"');
  });
});
