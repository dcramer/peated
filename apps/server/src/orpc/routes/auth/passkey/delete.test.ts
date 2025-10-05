import { db } from "@peated/server/db";
import { passkeys } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("DELETE /auth/passkey/:passkeyId", () => {
  test("deletes passkey when user has password", async ({ fixtures }) => {
    const user = await fixtures.User({ password: "testpassword" });
    const passkey = await fixtures.Passkey({ userId: user.id });

    await routerClient.auth.passkey.delete(
      { passkeyId: passkey.id },
      {
        context: { user },
      },
    );

    const deletedPasskey = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.id, passkey.id));

    expect(deletedPasskey).toHaveLength(0);
  });

  test("deletes passkey when user has multiple passkeys", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const passkey1 = await fixtures.Passkey({ userId: user.id });
    const passkey2 = await fixtures.Passkey({ userId: user.id });

    await routerClient.auth.passkey.delete(
      { passkeyId: passkey1.id },
      {
        context: { user },
      },
    );

    const remainingPasskeys = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.userId, user.id));

    expect(remainingPasskeys).toHaveLength(1);
    expect(remainingPasskeys[0].id).toBe(passkey2.id);
  });

  test("prevents deleting last passkey when user has no password", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ passwordHash: null });
    const passkey = await fixtures.Passkey({ userId: user.id });

    const err = await waitError(
      routerClient.auth.passkey.delete(
        { passkeyId: passkey.id },
        {
          context: { user },
        },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot delete your last passkey. Please set a password first to ensure you can still access your account.]`,
    );

    // Verify passkey still exists
    const [existingPasskey] = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.id, passkey.id));

    expect(existingPasskey).toBeDefined();
  });

  test("returns NOT_FOUND when passkey doesn't exist", async ({ fixtures }) => {
    const user = await fixtures.User();

    const err = await waitError(
      routerClient.auth.passkey.delete(
        { passkeyId: 99999 },
        {
          context: { user },
        },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Passkey not found]`);
  });

  test("returns NOT_FOUND when passkey belongs to different user", async ({
    fixtures,
  }) => {
    const user1 = await fixtures.User();
    const user2 = await fixtures.User();
    const passkey = await fixtures.Passkey({ userId: user2.id });

    const err = await waitError(
      routerClient.auth.passkey.delete(
        { passkeyId: passkey.id },
        {
          context: { user: user1 },
        },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Passkey not found]`);

    // Verify passkey still exists
    const [existingPasskey] = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.id, passkey.id));

    expect(existingPasskey).toBeDefined();
  });
});
