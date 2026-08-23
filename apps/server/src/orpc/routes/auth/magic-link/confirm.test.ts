import { createRouterClient } from "@orpc/server";
import waitError from "@peated/server/lib/test/waitError";
import {
  createMagicLinkConfirmProcedure,
  type MagicLinkAuthServices,
} from "@peated/server/orpc/routes/auth/magic-link/confirm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const createAccessToken = vi.fn<MagicLinkAuthServices["createToken"]>();
const verifyPayload = vi.fn<MagicLinkAuthServices["verifyToken"]>();
const confirmClient = createRouterClient(
  {
    confirm: createMagicLinkConfirmProcedure({
      createToken: createAccessToken,
      verifyToken: verifyPayload,
    }),
  },
  { context: { ip: "127.0.0.1", user: null } },
);

describe("POST /auth/magic-link/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("confirms magic link for active user", async ({ fixtures }) => {
    const user = await fixtures.User({ active: true, verified: false });
    const token = "valid-token";

    verifyPayload.mockResolvedValue({
      id: user.id,
      email: user.email,
      createdAt: new Date().toISOString(),
    });

    createAccessToken.mockResolvedValue("mocked-access-token");

    const result = await confirmClient.confirm({ token });

    expect(result.user.id).toBe(user.id);
    expect(result.user.verified).toBe(true);
    expect(result.accessToken).toBe("mocked-access-token");
    expect(createAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: user.id }),
    );
  });

  test("throws error for invalid token", async ({ fixtures }) => {
    const token = "invalid-token";

    verifyPayload.mockRejectedValue(new Error("Invalid token"));

    const error = await waitError(confirmClient.confirm({ token }));

    expect(error).toMatchInlineSnapshot(`[Error: Invalid magic link token.]`);
  });

  test("throws error for expired token", async ({ fixtures }) => {
    const user = await fixtures.User({ active: true });
    const token = "expired-token";

    const expiredDate = new Date();
    expiredDate.setMinutes(expiredDate.getMinutes() - 11); // 11 minutes ago

    verifyPayload.mockResolvedValue({
      id: user.id,
      email: user.email,
      createdAt: expiredDate.toISOString(),
    });

    const error = await waitError(confirmClient.confirm({ token }));

    expect(error).toMatchInlineSnapshot(`[Error: Invalid magic link token.]`);
  });

  test("throws error for inactive user", async ({ fixtures }) => {
    const user = await fixtures.User({ active: false });
    const token = "valid-token";

    verifyPayload.mockResolvedValue({
      id: user.id,
      email: user.email,
      createdAt: new Date().toISOString(),
    });

    const error = await waitError(confirmClient.confirm({ token }));

    expect(error).toMatchInlineSnapshot(`[Error: Invalid magic link token.]`);
  });

  test("throws error for non-existent user", async ({ fixtures }) => {
    const token = "valid-token";

    verifyPayload.mockResolvedValue({
      id: "non-existent-id",
      email: "nonexistent@example.com",
      createdAt: new Date().toISOString(),
    });

    const error = await waitError(confirmClient.confirm({ token }));

    expect(error).toMatchInlineSnapshot(`[Error: Invalid magic link token.]`);
  });
});
