import waitError from "@peated/server/lib/test/waitError";
import { describe, expect, test } from "vitest";
import { routerClient } from "../router";

describe("GET /users/:id", () => {
  test("get user by id", async ({ defaults, fixtures }) => {
    const user = await fixtures.User();

    const data = await routerClient.userById(
      { id: user.id },
      { context: { user: defaults.user } },
    );
    expect(data.id).toEqual(user.id);
    expect(data.friendStatus).toBe("none");
  });

  test("get user:me", async ({ defaults }) => {
    const data = await routerClient.userById(
      { id: "me" },
      { context: { user: defaults.user } },
    );
    expect(data.id).toBe(defaults.user.id);
  });

  test("get user by username", async ({ defaults }) => {
    const data = await routerClient.userById(
      { id: defaults.user.username },
      { context: { user: defaults.user } },
    );
    expect(data.id).toBe(defaults.user.id);
  });

  test("get user w/ friendStatus", async ({ defaults, fixtures }) => {
    const user = await fixtures.User();
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: user.id,
    });

    const data = await routerClient.userById(
      { id: user.id },
      { context: { user: defaults.user } },
    );
    expect(data.id).toBe(user.id);
    expect(data.friendStatus).toBe("friends");
  });

  test("errors on invalid username", async () => {
    const err = await waitError(() =>
      routerClient.userById({ id: "notauser" }),
    );
    expect(err).toMatchInlineSnapshot();
  });
});
