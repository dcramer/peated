import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /users", () => {
  test("lists users needs a query", async ({ defaults, fixtures }) => {
    await fixtures.User();

    const { results } = await routerClient.users.list(
      {},
      { context: { user: defaults.user } },
    );

    expect(results.length).toBe(0);
  });

  test("lists users with query", async ({ defaults, fixtures }) => {
    const user2 = await fixtures.User({ username: "david.george" });

    const { results } = await routerClient.users.list(
      {
        query: "david",
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(user2.id);
  });

  test("requires authentication", async () => {
    const err = await waitError(() => routerClient.users.list());
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
