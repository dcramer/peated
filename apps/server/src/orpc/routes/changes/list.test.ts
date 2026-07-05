import { getUserActor } from "@peated/server/lib/actors";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /changes", () => {
  test("lists changes", async ({ defaults, fixtures }) => {
    await fixtures.Entity({ name: "Entity 1" });
    await fixtures.Entity({ name: "Entity 2" });

    const { results } = await routerClient.changes.list(
      {},
      {
        context: { user: defaults.user },
      },
    );

    expect(results.length).toBe(2);
  });

  test("filters changes by user actor", async ({ defaults, fixtures }) => {
    const user = defaults.user;
    const otherUser = await fixtures.User();
    const userActor = await getUserActor(user);
    const otherActor = await getUserActor(otherUser);

    const entity = await fixtures.Entity({
      name: "User Entity",
      createdByActorId: userActor.id,
    });
    await fixtures.Entity({
      name: "Other Entity",
      createdByActorId: otherActor.id,
    });

    const { results: ownResults } = await routerClient.changes.list(
      { user: "me" },
      { context: { user } },
    );
    expect(ownResults.map((change) => change.objectId)).toEqual([entity.id]);

    const { results: otherResults } = await routerClient.changes.list(
      { user: otherUser.id },
      { context: { user } },
    );
    expect(otherResults).toHaveLength(1);
    expect(otherResults[0].createdByActor.id).toBe(otherActor.id);
  });
});
