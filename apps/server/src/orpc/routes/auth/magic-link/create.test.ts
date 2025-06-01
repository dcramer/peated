import { sendMagicLinkEmail } from "@peated/server/lib/email";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the sendMagicLinkEmail function
vi.mock("@peated/server/lib/email", () => ({
  sendMagicLinkEmail: vi.fn(),
}));

describe("POST /auth/magic-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sends magic link for active user", async ({ fixtures }) => {
    const user = await fixtures.User({ active: true });

    const result = await routerClient.auth.magicLink.create({
      email: user.email,
    });

    expect(result).toEqual({});
    expect(sendMagicLinkEmail).toHaveBeenCalledWith({ user });
  });

  test("throws error when user is not found", async ({ fixtures }) => {
    const error = await waitError(
      routerClient.auth.magicLink.create({
        email: "nonexistent@example.com",
      })
    );

    expect(error).toMatchInlineSnapshot("[Error: Account not found.]");
  });

  test("throws error when user is not active", async ({ fixtures }) => {
    const user = await fixtures.User({ active: false });

    const error = await waitError(
      routerClient.auth.magicLink.create({
        email: user.email,
      })
    );

    expect(error).toMatchInlineSnapshot("[Error: Account not found.]");
  });

  test("is case-insensitive for email", async ({ fixtures }) => {
    const user = await fixtures.User({
      active: true,
      email: "User@Example.com",
    });

    const result = await routerClient.auth.magicLink.create({
      email: "uSER@eXAMPLE.COM",
    });

    expect(result).toEqual({});
    expect(sendMagicLinkEmail).toHaveBeenCalledWith({ user });
  });
});
