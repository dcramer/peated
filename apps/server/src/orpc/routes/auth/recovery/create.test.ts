import { createRouterClient } from "@orpc/server";
import waitError from "@peated/server/lib/test/waitError";
import { createAuthRateLimit } from "@peated/server/orpc/middleware/rateLimit";
import {
  createRecoveryProcedure,
  type PasswordResetEmailSender,
  type RecoveryErrorReporter,
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

  test("does not include the recovery email in failure telemetry", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const error = new Error("email provider unavailable");
    const failingSender = vi
      .fn<PasswordResetEmailSender>()
      .mockRejectedValue(error);
    const reportError = vi.fn<RecoveryErrorReporter>();
    const client = createRouterClient(
      {
        create: createRecoveryProcedure(failingSender, undefined, reportError),
      },
      { context: { ip: "127.0.0.1", user: null } },
    );

    await client.create({ email: user.email });

    expect(reportError).toHaveBeenCalledWith(error, {
      extra: { name: "auth/recovery/create" },
    });
    expect(JSON.stringify(reportError.mock.calls)).not.toContain(user.email);
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

  test("stops requests when the rate-limit counter fails", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const counterError = new Error("Redis unavailable");
    const client = createRouterClient(
      {
        create: createRecoveryProcedure(
          sendPasswordResetEmail,
          createAuthRateLimit(async () => {
            throw counterError;
          }),
        ),
      },
      { context: { ip: "127.0.0.1", user: null } },
    );

    await expect(client.create({ email: user.email })).rejects.toThrow(
      counterError,
    );
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test("allows 15 requests per IP and rejects the next request", async () => {
    for (let count = 0; count < 15; count++) {
      await expect(
        recoveryClient.create({ email: "nonexistent@example.com" }),
      ).resolves.toEqual({});
    }

    await expect(
      recoveryClient.create({ email: "nonexistent@example.com" }),
    ).rejects.toThrow("Too many requests. Please try again later.");

    const otherClient = createRouterClient(
      { create: createRecoveryProcedure(sendPasswordResetEmail) },
      { context: { ip: "127.0.0.2", user: null } },
    );
    await expect(
      otherClient.create({ email: "nonexistent@example.com" }),
    ).resolves.toEqual({});
  });
});
