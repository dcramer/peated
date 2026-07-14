import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
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

  test("counts non-empty Library bottles by status", async ({
    defaults,
    fixtures,
  }) => {
    const library = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const otherCollection = await fixtures.Collection({
      name: "Other Collection",
      createdById: defaults.user.id,
    });
    const [openBottle, sealedBottle, emptyBottle, unsetBottle, otherBottle] =
      await Promise.all([
        fixtures.Bottle(),
        fixtures.Bottle(),
        fixtures.Bottle(),
        fixtures.Bottle(),
        fixtures.Bottle(),
      ]);

    await db.insert(collectionBottles).values([
      {
        collectionId: library.id,
        bottleId: openBottle.id,
        status: "open",
      },
      {
        collectionId: library.id,
        bottleId: sealedBottle.id,
        status: "sealed",
      },
      {
        collectionId: library.id,
        bottleId: emptyBottle.id,
        status: "empty",
      },
      {
        collectionId: library.id,
        bottleId: unsetBottle.id,
        status: null,
      },
      {
        collectionId: otherCollection.id,
        bottleId: otherBottle.id,
        status: "open",
      },
    ]);

    const data = await routerClient.users.details(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data.stats.library).toEqual({
      total: 3,
      open: 1,
      sealed: 1,
    });
  });

  test("errors on invalid username", async () => {
    const err = await waitError(() =>
      routerClient.users.details({ user: "notauser" }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: User not found]`);
  });
});
