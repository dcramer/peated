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

test("preserves the bottle check detail URL when redirecting to login", async () => {
  getSessionMock.mockResolvedValue({ user: null });

  await expect(
    Layout({
      children: "detail",
      params: Promise.resolve({ checkId: "91" }),
    }),
  ).rejects.toThrow("redirected");

  expect(redirectToAuthMock).toHaveBeenCalledWith({
    pathname: "/bottle-checks/91",
  });
});

test("allows moderators to view bottle check details", async () => {
  getSessionMock.mockResolvedValue({ user: { mod: true, admin: false } });

  await expect(
    Layout({
      children: "detail",
      params: Promise.resolve({ checkId: "91" }),
    }),
  ).resolves.toBe("detail");
});
