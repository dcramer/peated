import { sendMagicLinkEmail } from "@peated/server/lib/email";
import waitError from "@peated/server/lib/test/waitError";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { createCaller } from "../trpc/router";

// Mock the sendMagicLinkEmail function
vi.mock("@peated/server/lib/email", () => ({
  sendMagicLinkEmail: vi.fn(),
}));

describe("authMagicLinkSend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sends magic link for active user", async ({ fixtures }) => {
    const user = await fixtures.User({ active: true });
    const caller = createCaller({ user: null });

    const result = await caller.authMagicLinkSend({
      email: user.email,
    });

    expect(result).toEqual({});
    expect(sendMagicLinkEmail).toHaveBeenCalledWith({ user });
  });

  test("throws error when user is not found", async ({ fixtures }) => {
    const caller = createCaller({ user: null });

    const error = await waitError(
      caller.authMagicLinkSend({
        email: "nonexistent@example.com",
      }),
    );

    expect(error).toMatchInlineSnapshot(`[TRPCError: Account not found.]`);
  });

  test("throws error when user is not active", async ({ fixtures }) => {
    const user = await fixtures.User({ active: false });
    const caller = createCaller({ user: null });

    const error = await waitError(
      caller.authMagicLinkSend({
        email: user.email,
      }),
    );

    expect(error).toMatchInlineSnapshot(`[TRPCError: Account not found.]`);
  });

  test("is case-insensitive for email", async ({ fixtures }) => {
    const user = await fixtures.User({
      active: true,
      email: "User@Example.com",
    });
    const caller = createCaller({ user: null });

    const result = await caller.authMagicLinkSend({
      email: "uSER@eXAMPLE.COM",
    });

    expect(result).toEqual({});
    expect(sendMagicLinkEmail).toHaveBeenCalledWith({ user });
  });
});
