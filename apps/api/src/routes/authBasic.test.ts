import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../trpc/router";

test("valid credentials", async ({ fixtures }) => {
  const caller = createCaller();

  const user = await fixtures.User({
    email: "foo@example.com",
    password: "example",
  });

  const data = await caller.authBasic({
    email: "foo@example.com",
    password: "example",
  });

  expect(data.user.id).toEqual(user.id);
  expect(data.accessToken).toBeDefined();
});

test("invalid credentials", async ({ fixtures }) => {
  const caller = createCaller();

  const user = await fixtures.User({
    email: "foo@example.com",
    password: "example",
  });

  const err = await waitError(
    caller.authBasic({
      email: "foo@example.com",
      password: "example2",
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: Invalid credentials.]`);
});
