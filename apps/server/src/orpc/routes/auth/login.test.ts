import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("POST /auth/login", () => {
  test("valid credentials", async ({ fixtures }) => {
    const user = await fixtures.User({
      email: "foo@example.com",
      password: "example",
    });

    const data = await routerClient.auth.login({
      email: "foo@example.com",
      password: "example",
    });

    expect(data.user.id).toEqual(user.id);
    expect(data.accessToken).toBeDefined();
  });

  test("invalid credentials", async ({ fixtures }) => {
    await fixtures.User({
      email: "foo@example.com",
      password: "example",
    });

    const err = await waitError(
      routerClient.auth.login({
        email: "foo@example.com",
        password: "example2",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Invalid credentials.]`);
  });
});
