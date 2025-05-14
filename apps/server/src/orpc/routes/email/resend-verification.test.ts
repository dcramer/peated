import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("POST /email/resend-verification", () => {
  test("initiates email", async ({ fixtures }) => {
    const user = await fixtures.User({ verified: false });

    await routerClient.email.resendVerification(undefined, {
      context: { user },
    });
  });

  test("already verified", async ({ fixtures }) => {
    const user = await fixtures.User({ verified: true });

    const err = await waitError(() =>
      routerClient.email.resendVerification(undefined, {
        context: { user },
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized]`);
  });
});
