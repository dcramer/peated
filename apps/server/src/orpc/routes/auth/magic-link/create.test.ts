import { createRouterClient } from "@orpc/server";
import waitError from "@peated/server/lib/test/waitError";
import {
  createMagicLinkProcedure,
  type MagicLinkSender,
} from "@peated/server/orpc/routes/auth/magic-link/create";
import { beforeEach, describe, expect, test, vi } from "vitest";

const sendMagicLinkEmail = vi.fn<MagicLinkSender>();
const magicLinkClient = createRouterClient(
  { create: createMagicLinkProcedure(sendMagicLinkEmail) },
  { context: { ip: "127.0.0.1", user: null } },
);

describe("POST /auth/magic-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sends magic link for active user", async ({ fixtures }) => {
    const user = await fixtures.User({ active: true });

    const result = await magicLinkClient.create({ email: user.email });

    expect(result).toEqual({});
    expect(sendMagicLinkEmail).toHaveBeenCalledWith({ user });
  });

  test("throws error when magic link email delivery fails", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ active: true });
    vi.mocked(sendMagicLinkEmail).mockRejectedValueOnce(
      new Error("SMTP credentials are not configured"),
    );

    const error = await waitError(
      magicLinkClient.create({ email: user.email }),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Unable to send magic link email.]`,
    );
  });

  test("throws error when user is not found", async ({ fixtures }) => {
    const error = await waitError(
      magicLinkClient.create({ email: "nonexistent@example.com" }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Account not found.]`);
  });

  test("throws error when user is not active", async ({ fixtures }) => {
    const user = await fixtures.User({ active: false });

    const error = await waitError(
      magicLinkClient.create({ email: user.email }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Account not found.]`);
  });

  test("is case-insensitive for email", async ({ fixtures }) => {
    const user = await fixtures.User({
      active: true,
      email: "User@Example.com",
    });

    const result = await magicLinkClient.create({
      email: "uSER@eXAMPLE.COM",
    });

    expect(result).toEqual({});
    expect(sendMagicLinkEmail).toHaveBeenCalledWith({ user });
  });
});
