import { db } from "@peated/server/db";
import { changes } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /changes", () => {
  test("lists changes", async ({ defaults, fixtures }) => {
    const first = await fixtures.Entity({ name: "Entity 1" });
    const second = await fixtures.Entity({ name: "Entity 2" });
    const third = await fixtures.Entity({ name: "Entity 3" });

    const firstPage = await routerClient.changes.list(
      { limit: 2 },
      {
        context: { user: defaults.user },
      },
    );
    expect(firstPage.results.map(({ objectId }) => objectId)).toEqual([
      third.id,
      second.id,
    ]);
    expect(firstPage.rel).toEqual({ nextCursor: 2, prevCursor: null });

    const secondPage = await routerClient.changes.list(
      { cursor: firstPage.rel.nextCursor!, limit: 2 },
      { context: { user: defaults.user } },
    );
    expect(secondPage.results.map(({ objectId }) => objectId)).toEqual([
      first.id,
    ]);
    expect(secondPage.rel).toEqual({ nextCursor: null, prevCursor: 1 });
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

  test("keeps historical object types out of the current feed", async ({
    defaults,
  }) => {
    const actor = await getUserActor(defaults.user);
    await db.insert(changes).values({
      objectType: "bottle_release",
      objectId: 42,
      actorId: actor.id,
      displayName: "Historical release",
      type: "add",
      data: {},
    });

    const { results } = await routerClient.changes.list(
      {},
      { context: { user: defaults.user } },
    );

    expect(results).toEqual([]);
  });
});
