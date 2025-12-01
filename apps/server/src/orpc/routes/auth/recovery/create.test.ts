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

    await routerClient.auth.recovery.create(
      {
        email: user.email,
      },
      { context: { ip: "127.0.0.1" } },
    );

    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith({ user });
  });

  test("does not leak information for non-existent user", async () => {
    const nonExistentEmail = "nonexistent@example.com";

    // Should return success even for non-existent users (prevents user enumeration)
    await routerClient.auth.recovery.create(
      {
        email: nonExistentEmail,
      },
      { context: { ip: "127.0.0.1" } },
    );

    // Email should not be sent for non-existent user
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test("throws error for invalid email format", async () => {
    const invalidEmail = "invalid-email";

    const err = await waitError(
      routerClient.auth.recovery.create(
        {
          email: invalidEmail,
        },
        { context: { ip: "127.0.0.1" } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
