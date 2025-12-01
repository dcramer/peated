import { db } from "@peated/server/db";
import { passkeys } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("PATCH /auth/passkey/:passkeyId", () => {
  test("updates nickname for own passkey", async ({ fixtures }) => {
    const user = await fixtures.User();
    const passkey = await fixtures.Passkey({
      userId: user.id,
      nickname: "Old Name",
    });

    const result = await routerClient.auth.passkey.update(
      { passkeyId: passkey.id, nickname: "New Name" },
      {
        context: { user },
      },
    );

    expect(result.ok).toBe(true);

    const [updated] = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.id, passkey.id));

    expect(updated.nickname).toBe("New Name");
  });

  test("allows setting nickname to null", async ({ fixtures }) => {
    const user = await fixtures.User();
    const passkey = await fixtures.Passkey({
      userId: user.id,
      nickname: "Some Name",
    });

    const result = await routerClient.auth.passkey.update(
      { passkeyId: passkey.id, nickname: null },
      {
        context: { user },
      },
    );

    expect(result.ok).toBe(true);

    const [updated] = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.id, passkey.id));

    expect(updated.nickname).toBeNull();
  });

  test("rejects update for another user's passkey", async ({ fixtures }) => {
    const user1 = await fixtures.User();
    const user2 = await fixtures.User();
    const passkey = await fixtures.Passkey({ userId: user2.id });

    const err = await waitError(
      routerClient.auth.passkey.update(
        { passkeyId: passkey.id, nickname: "Hacked" },
        {
          context: { user: user1 },
        },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Passkey not found]`);

    // Verify passkey unchanged
    const [unchanged] = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.id, passkey.id));

    expect(unchanged.nickname).not.toBe("Hacked");
  });

  test("returns NOT_FOUND for non-existent passkey", async ({ fixtures }) => {
    const user = await fixtures.User();

    const err = await waitError(
      routerClient.auth.passkey.update(
        { passkeyId: 99999, nickname: "Test" },
        {
          context: { user },
        },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Passkey not found]`);
  });

  test("validates nickname length", async ({ fixtures }) => {
    const user = await fixtures.User();
    const passkey = await fixtures.Passkey({ userId: user.id });

    const err = await waitError(
      routerClient.auth.passkey.update(
        { passkeyId: passkey.id, nickname: "a".repeat(101) },
        {
          context: { user },
        },
      ),
    );

    expect(err).toBeDefined();
  });

  test("rejects nickname with HTML tags", async ({ fixtures }) => {
    const user = await fixtures.User();
    const passkey = await fixtures.Passkey({ userId: user.id });

    const err = await waitError(
      routerClient.auth.passkey.update(
        { passkeyId: passkey.id, nickname: "<script>alert(1)</script>" },
        {
          context: { user },
        },
      ),
    );

    expect(err).toBeDefined();
  });

  test("rejects empty nickname string", async ({ fixtures }) => {
    const user = await fixtures.User();
    const passkey = await fixtures.Passkey({ userId: user.id });

    const err = await waitError(
      routerClient.auth.passkey.update(
        { passkeyId: passkey.id, nickname: "" },
        {
          context: { user },
        },
      ),
    );

    expect(err).toBeDefined();
  });

  test("trims whitespace from nickname", async ({ fixtures }) => {
    const user = await fixtures.User();
    const passkey = await fixtures.Passkey({ userId: user.id });

    await routerClient.auth.passkey.update(
      { passkeyId: passkey.id, nickname: "  Test Name  " },
      {
        context: { user },
      },
    );

    const [updated] = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.id, passkey.id));

    expect(updated.nickname).toBe("Test Name");
  });
});
