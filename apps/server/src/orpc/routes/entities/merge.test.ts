import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("POST /entities/:entity/merge", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.entities.merge(
        {
          entity: 1,
          other: 2,
        },
        { context: { user: null } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod", async ({ defaults }) => {
    const err = await waitError(
      routerClient.entities.merge(
        {
          entity: 1,
          other: 2,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  // TODO: test call to pushJob
  test("merge A into B", async ({ fixtures }) => {
    const entityA = await fixtures.Entity({
      totalTastings: 1,
      totalBottles: 2,
    });
    const entityB = await fixtures.Entity({
      totalTastings: 3,
      totalBottles: 1,
    });
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.entities.merge(
      {
        entity: entityA.id,
        other: entityB.id,
        direction: "mergeInto",
      },
      { context: { user: modUser } },
    );

    expect(data.id).toEqual(entityB.id);
  });

  // TODO: test call to pushJob
  test("merge A from B", async ({ fixtures }) => {
    const entityA = await fixtures.Entity({
      totalTastings: 1,
      totalBottles: 2,
    });
    const entityB = await fixtures.Entity({
      totalTastings: 3,
      totalBottles: 1,
    });
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.entities.merge(
      {
        entity: entityA.id,
        other: entityB.id,
        direction: "mergeFrom",
      },
      { context: { user: modUser } },
    );

    expect(data.id).toEqual(entityA.id);
  });
});
