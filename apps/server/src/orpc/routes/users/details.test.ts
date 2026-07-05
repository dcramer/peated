import { getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /users/:user", () => {
  test("get user by id", async ({ defaults, fixtures }) => {
    const user = await fixtures.User();

    const data = await routerClient.users.details(
      { user: user.id },
      { context: { user: defaults.user } },
    );
    expect(data.id).toEqual(user.id);
    expect(data.friendStatus).toBe("none");
  });

  test("get user:me", async ({ defaults }) => {
    const data = await routerClient.users.details(
      { user: "me" },
      { context: { user: defaults.user } },
    );
    expect(data.id).toBe(defaults.user.id);
  });

  test("get user by username", async ({ defaults }) => {
    const data = await routerClient.users.details(
      { user: defaults.user.username },
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

    const data = await routerClient.users.details(
      { user: user.id },
      { context: { user: defaults.user } },
    );
    expect(data.id).toBe(user.id);
    expect(data.friendStatus).toBe("friends");
  });

  test("counts actor-backed catalog contributions", async ({
    defaults,
    fixtures,
  }) => {
    const targetActor = await getUserActor(defaults.user);
    const otherUser = await fixtures.User();
    const otherActor = await getUserActor(otherUser);

    await fixtures.Entity({
      name: "Target Contribution",
      createdByActorId: targetActor.id,
    });
    await fixtures.Entity({
      name: "Other Contribution",
      createdByActorId: otherActor.id,
    });

    const data = await routerClient.users.details(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data.stats.contributions).toBe(1);
  });

  test("errors on invalid username", async () => {
    const err = await waitError(() =>
      routerClient.users.details({ user: "notauser" }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: User not found]`);
  });
});
