import waitError from "@peated/server/lib/test/waitError";
import { describe, expect, test } from "vitest";
import { routerClient } from "../router";

describe("POST /email/resend-verification", () => {
  test("initiates email", async ({ fixtures }) => {
    const user = await fixtures.User({ verified: false });

    await routerClient.emailResendVerification(undefined, {
      context: { user },
    });
  });

  test("already verified", async ({ fixtures }) => {
    const user = await fixtures.User({ verified: true });

    const err = await waitError(() =>
      routerClient.emailResendVerification(undefined, {
        context: { user },
      }),
    );

    expect(err).toMatchInlineSnapshot();
  });
});
