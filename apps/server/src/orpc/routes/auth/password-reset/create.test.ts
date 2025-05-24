import { sendPasswordResetEmail } from "@peated/server/lib/email";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the sendPasswordResetEmail function
vi.mock("@peated/server/lib/email", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

describe("POST /auth/password-reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("initiates password reset email for existing user", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();

    await routerClient.auth.passwordReset.create({
      email: user.email,
    });

    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith({ user });
  });

  test("does not leak information for non-existent user", async () => {
    const nonExistentEmail = "nonexistent@example.com";

    const err = await waitError(
      routerClient.auth.passwordReset.create({
        email: nonExistentEmail,
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Account not found.]`);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test("throws error for invalid email format", async () => {
    const invalidEmail = "invalid-email";

    const err = await waitError(
      routerClient.auth.passwordReset.create({
        email: invalidEmail,
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
