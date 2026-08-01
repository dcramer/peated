import { beforeEach, expect, test, vi } from "vitest";

const { getSessionMock, redirectToAuthMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  redirectToAuthMock: vi.fn(() => {
    throw new Error("redirected");
  }),
}));

vi.mock("@peated/web/lib/session.server", () => ({
  getSession: getSessionMock,
}));

vi.mock("@peated/web/lib/auth", () => ({
  redirectToAuth: redirectToAuthMock,
}));

import Layout from "./layout";

beforeEach(() => {
  getSessionMock.mockReset();
  redirectToAuthMock.mockClear();
});

test("redirects signed-out users back to the bottle check inbox", async () => {
  getSessionMock.mockResolvedValue({ user: null });

  await expect(Layout({ children: "inbox" })).rejects.toThrow("redirected");

  expect(redirectToAuthMock).toHaveBeenCalledWith({
    pathname: "/bottle-checks",
  });
});

test("allows moderators to view the bottle check inbox", async () => {
  getSessionMock.mockResolvedValue({ user: { mod: true, admin: false } });

  await expect(Layout({ children: "inbox" })).resolves.toBe("inbox");
});
