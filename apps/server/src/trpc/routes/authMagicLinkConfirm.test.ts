import { createAccessToken, verifyPayload } from "@peated/server/lib/auth";
import waitError from "@peated/server/lib/test/waitError";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createCaller } from "../router";

// Mock the auth functions
vi.mock("@peated/server/lib/auth", () => ({
  createAccessToken: vi.fn().mockResolvedValue("mocked-access-token"),
  verifyPayload: vi.fn(),
}));

describe("authMagicLinkConfirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("confirms magic link for active user", async ({ fixtures }) => {
    const user = await fixtures.User({ active: true, verified: false });
    const caller = createCaller({ user: null });
    const token = "valid-token";

    vi.mocked(verifyPayload).mockResolvedValue({
      id: user.id,
      email: user.email,
      createdAt: new Date().toISOString(),
    });

    const result = await caller.authMagicLinkConfirm({ token });

    expect(result.user.id).toBe(user.id);
    expect(result.user.verified).toBe(true);
    expect(result.accessToken).toBe("mocked-access-token");
    expect(createAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: user.id }),
    );
  });

  test("throws error for invalid token", async ({ fixtures }) => {
    const caller = createCaller({ user: null });
    const token = "invalid-token";

    vi.mocked(verifyPayload).mockRejectedValue(new Error("Invalid token"));

    const error = await waitError(caller.authMagicLinkConfirm({ token }));

    expect(error).toMatchInlineSnapshot(
      `[TRPCError: Invalid magic link token.]`,
    );
  });

  test("throws error for expired token", async ({ fixtures }) => {
    const user = await fixtures.User({ active: true });
    const caller = createCaller({ user: null });
    const token = "expired-token";

    const expiredDate = new Date();
    expiredDate.setMinutes(expiredDate.getMinutes() - 11); // 11 minutes ago

    vi.mocked(verifyPayload).mockResolvedValue({
      id: user.id,
      email: user.email,
      createdAt: expiredDate.toISOString(),
    });

    const error = await waitError(caller.authMagicLinkConfirm({ token }));

    expect(error).toMatchInlineSnapshot(
      `[TRPCError: Invalid magic link token.]`,
    );
  });

  test("throws error for inactive user", async ({ fixtures }) => {
    const user = await fixtures.User({ active: false });
    const caller = createCaller({ user: null });
    const token = "valid-token";

    vi.mocked(verifyPayload).mockResolvedValue({
      id: user.id,
      email: user.email,
      createdAt: new Date().toISOString(),
    });

    const error = await waitError(caller.authMagicLinkConfirm({ token }));

    expect(error).toMatchInlineSnapshot(
      `[TRPCError: Invalid magic link token.]`,
    );
  });

  test("throws error for non-existent user", async ({ fixtures }) => {
    const caller = createCaller({ user: null });
    const token = "valid-token";

    vi.mocked(verifyPayload).mockResolvedValue({
      id: "non-existent-id",
      email: "nonexistent@example.com",
      createdAt: new Date().toISOString(),
    });

    const error = await waitError(caller.authMagicLinkConfirm({ token }));

    expect(error).toMatchInlineSnapshot(
      `[TRPCError: Invalid magic link token.]`,
    );
  });
});
