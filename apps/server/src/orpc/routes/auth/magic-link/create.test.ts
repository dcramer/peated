import { createRouterClient } from "@orpc/server";
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

  test("does not reveal email delivery failures", async ({ fixtures }) => {
    const user = await fixtures.User({ active: true });
    vi.mocked(sendMagicLinkEmail).mockRejectedValueOnce(
      new Error("SMTP credentials are not configured"),
    );

    await expect(
      magicLinkClient.create({ email: user.email }),
    ).resolves.toEqual({});
  });

  test("does not reveal when user is not found", async () => {
    await expect(
      magicLinkClient.create({ email: "nonexistent@example.com" }),
    ).resolves.toEqual({});
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
  });

  test("does not reveal when user is not active", async ({ fixtures }) => {
    const user = await fixtures.User({ active: false });

    await expect(
      magicLinkClient.create({ email: user.email }),
    ).resolves.toEqual({});
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
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
