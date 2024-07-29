import { createCaller } from "../router";

test("initiates email", async ({ fixtures }) => {
  const user = await fixtures.User();

  const caller = createCaller({ user: null });

  await caller.authPasswordReset({
    email: user.email,
  });
});
