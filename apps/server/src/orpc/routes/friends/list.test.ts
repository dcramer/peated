import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /friends", () => {
  test("lists friends", async ({ defaults, fixtures }) => {
    const follow1 = await fixtures.Follow({
      fromUserId: defaults.user.id,
    });
    await fixtures.Follow();

    const { results } = await routerClient.friends.list(
      {},
      { context: { user: defaults.user } },
    );

    expect(results.length).toBe(1);
    expect(results[0].user.id).toBe(follow1.toUserId);
  });

  test("requires authentication", async () => {
    const err = await waitError(() => routerClient.friends.list());
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
