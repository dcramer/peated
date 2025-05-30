import { createAccessToken, verifyPayload } from "@peated/server/lib/auth";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the auth functions
vi.mock("@peated/server/lib/auth", () => ({
  createAccessToken: vi.fn(),
  verifyPayload: vi.fn(),
}));

describe("POST /auth/magic-link/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("confirms magic link for active user", async ({ fixtures }) => {
    const user = await fixtures.User({ active: true, verified: false });
    const token = "valid-token";

    vi.mocked(verifyPayload).mockResolvedValue({
      id: user.id,
      email: user.email,
      createdAt: new Date().toISOString(),
    });

    vi.mocked(createAccessToken).mockResolvedValue("mocked-access-token");

    const result = await routerClient.auth.magicLink.confirm({ token });

    expect(result.user.id).toBe(user.id);
    expect(result.user.verified).toBe(true);
    expect(result.accessToken).toBe("mocked-access-token");
    expect(createAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: user.id }),
    );
  });

  test("throws error for invalid token", async ({ fixtures }) => {
    const token = "invalid-token";

    vi.mocked(verifyPayload).mockRejectedValue(new Error("Invalid token"));

    const error = await waitError(
      routerClient.auth.magicLink.confirm({ token }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Invalid magic link token.]`);
  });

  test("throws error for expired token", async ({ fixtures }) => {
    const user = await fixtures.User({ active: true });
    const token = "expired-token";

    const expiredDate = new Date();
    expiredDate.setMinutes(expiredDate.getMinutes() - 11); // 11 minutes ago

    vi.mocked(verifyPayload).mockResolvedValue({
      id: user.id,
      email: user.email,
      createdAt: expiredDate.toISOString(),
    });

    const error = await waitError(
      routerClient.auth.magicLink.confirm({ token }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Invalid magic link token.]`);
  });

  test("throws error for inactive user", async ({ fixtures }) => {
    const user = await fixtures.User({ active: false });
    const token = "valid-token";

    vi.mocked(verifyPayload).mockResolvedValue({
      id: user.id,
      email: user.email,
      createdAt: new Date().toISOString(),
    });

    const error = await waitError(
      routerClient.auth.magicLink.confirm({ token }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Invalid magic link token.]`);
  });

  test("throws error for non-existent user", async ({ fixtures }) => {
    const token = "valid-token";

    vi.mocked(verifyPayload).mockResolvedValue({
      id: "non-existent-id",
      email: "nonexistent@example.com",
      createdAt: new Date().toISOString(),
    });

    const error = await waitError(
      routerClient.auth.magicLink.confirm({ token }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Invalid magic link token.]`);
  });
});
