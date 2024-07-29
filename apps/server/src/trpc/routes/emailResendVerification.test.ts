import { createCaller } from "../router";

test("initiates email", async ({ fixtures }) => {
  const user = await fixtures.User();
  const caller = createCaller({ user });

  await caller.emailResendVerification();
});
