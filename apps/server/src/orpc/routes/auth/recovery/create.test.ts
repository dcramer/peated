import { createRouterClient } from "@orpc/server";
import waitError from "@peated/server/lib/test/waitError";
import { createAuthRateLimit } from "@peated/server/orpc/middleware/rateLimit";
import {
  createRecoveryProcedure,
  type PasswordResetEmailSender,
} from "@peated/server/orpc/routes/auth/recovery/create";
import { beforeEach, describe, expect, test, vi } from "vitest";

const sendPasswordResetEmail = vi.fn<PasswordResetEmailSender>();
const recoveryClient = createRouterClient(
  { create: createRecoveryProcedure(sendPasswordResetEmail) },
  { context: { ip: "127.0.0.1", user: null } },
);

describe("POST /auth/password-reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("initiates password reset email for existing user", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();

    await recoveryClient.create({ email: user.email });

    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith({ user });
  });

  test("does not leak information for non-existent user", async () => {
    const nonExistentEmail = "nonexistent@example.com";

    // Should return success even for non-existent users (prevents user enumeration)
    await recoveryClient.create({ email: nonExistentEmail });

    // Email should not be sent for non-existent user
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test("throws error for invalid email format", async () => {
    const invalidEmail = "invalid-email";

    const err = await waitError(recoveryClient.create({ email: invalidEmail }));

    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test("enforces auth rate limits when Redis reports the request is over quota", async () => {
    const overLimitClient = createRouterClient(
      {
        create: createRecoveryProcedure(
          sendPasswordResetEmail,
          createAuthRateLimit(async () => 16),
        ),
      },
      { context: { ip: "127.0.0.1", user: null } },
    );

    const err = await waitError(
      overLimitClient.create({ email: "nonexistent@example.com" }),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Too many requests. Please try again later.]`,
    );
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
