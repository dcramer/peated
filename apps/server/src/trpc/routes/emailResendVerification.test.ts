import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("initiates email", async ({ fixtures }) => {
  const user = await fixtures.User();
  const caller = createCaller({ user });

  await caller.emailResendVerification();
});

test("already verified", async ({ fixtures }) => {
  const user = await fixtures.User({ verified: true });
  const caller = createCaller({ user });

  const err = await waitError(caller.emailResendVerification());

  expect(err).toMatchInlineSnapshot(`[TRPCError: Account already verified]`);
});
