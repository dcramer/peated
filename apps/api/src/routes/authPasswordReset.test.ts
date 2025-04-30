import { sendPasswordResetEmail } from "@peated/server/lib/email";
import waitError from "@peated/server/lib/test/waitError";
import { TRPCError } from "@trpc/server";
import { createCaller } from "../trpc/router";

// Mock the sendPasswordResetEmail function
vi.mock("@peated/server/lib/email", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

describe("authPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("initiates password reset email for existing user", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const caller = createCaller({ user: null });

    await caller.authPasswordReset({
      email: user.email,
    });

    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmail).toHaveBeenCalledWith({ user });
  });

  test("does not leak information for non-existent user", async () => {
    const caller = createCaller({ user: null });
    const nonExistentEmail = "nonexistent@example.com";

    const err = await waitError(
      caller.authPasswordReset({
        email: nonExistentEmail,
      }),
    );

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("NOT_FOUND");
    expect(err).toMatchInlineSnapshot(`[TRPCError: Account not found.]`);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test("throws error for invalid email format", async () => {
    const caller = createCaller({ user: null });
    const invalidEmail = "invalid-email";

    const err = await waitError(
      caller.authPasswordReset({
        email: invalidEmail,
      }),
    );

    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect(err).toMatchInlineSnapshot(`
      [TRPCError: [
        {
          "validation": "email",
          "code": "invalid_string",
          "message": "Invalid email",
          "path": [
            "email"
          ]
        }
      ]]
    `);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
