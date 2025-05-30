import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /auth/me", () => {
  test("returns user details for authenticated user", async ({ fixtures }) => {
    const user = await fixtures.User();
    const data = await routerClient.auth.me({}, { context: { user } });
    expect(data.user.id).toEqual(user.id);
    expect(data.user.email).toEqual(user.email);
  });

  test("throws UNAUTHORIZED for unauthenticated request", async () => {
    const err = await waitError(routerClient.auth.me({}));
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
