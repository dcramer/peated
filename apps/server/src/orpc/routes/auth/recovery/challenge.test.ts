import { signPayload } from "@peated/server/lib/auth";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { createHash } from "crypto";

describe("POST /auth/recovery/challenge", () => {
  test("generates challenge for valid recovery token", async ({ fixtures }) => {
    const user = await fixtures.User();

    const digest = createHash("sha256")
      .update(user.passwordHash || "")
      .digest("hex");

    const token = await signPayload({
      id: user.id,
      email: user.email,
      digest,
      createdAt: new Date().toISOString(),
    });

    const result = await routerClient.auth.recovery.challenge(
      { token },
      { context: { ip: "127.0.0.1" } },
    );

    expect(result.options).toBeDefined();
    expect(result.options.challenge).toBeDefined();
    expect(result.signedChallenge).toBeDefined();
  });

  test("rejects expired token", async ({ fixtures }) => {
    const user = await fixtures.User();

    const digest = createHash("sha256")
      .update(user.passwordHash || "")
      .digest("hex");

    // Token created 15 minutes ago (expired, limit is 10 min)
    const expiredDate = new Date(Date.now() - 15 * 60 * 1000);

    const token = await signPayload({
      id: user.id,
      email: user.email,
      digest,
      createdAt: expiredDate.toISOString(),
    });

    const err = await waitError(
      routerClient.auth.recovery.challenge(
        { token },
        { context: { ip: "127.0.0.1" } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Token has expired.]`);
  });

  test("rejects token with invalid digest", async ({ fixtures }) => {
    const user = await fixtures.User();

    const token = await signPayload({
      id: user.id,
      email: user.email,
      digest: "0".repeat(64), // Wrong digest
      createdAt: new Date().toISOString(),
    });

    const err = await waitError(
      routerClient.auth.recovery.challenge(
        { token },
        { context: { ip: "127.0.0.1" } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Invalid verification token.]`);
  });

  test("rejects token for non-existent user", async () => {
    const digest = createHash("sha256").update("").digest("hex");

    const token = await signPayload({
      id: 99999,
      email: "nonexistent@example.com",
      digest,
      createdAt: new Date().toISOString(),
    });

    const err = await waitError(
      routerClient.auth.recovery.challenge(
        { token },
        { context: { ip: "127.0.0.1" } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Invalid verification token.]`);
  });
});
