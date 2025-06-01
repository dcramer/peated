import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("POST /bottles/:bottle/merge-targets", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.bottles.merge(
        {
          bottle: 1,
          other: 2,
        },
        { context: { user: null } }
      )
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false, admin: false });
    const err = await waitError(
      routerClient.bottles.merge(
        {
          bottle: 1,
          other: 2,
        },
        { context: { user } }
      )
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  // TODO: test call to pushJob
  test("merge A into B", async ({ fixtures }) => {
    const bottleA = await fixtures.Bottle({ totalTastings: 1 });
    await fixtures.Tasting({ bottleId: bottleA.id });
    const bottleB = await fixtures.Bottle();
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.merge(
      {
        bottle: bottleA.id,
        other: bottleB.id,
        direction: "mergeInto",
      },
      { context: { user: modUser } }
    );

    expect(data.id).toEqual(bottleB.id);
  });

  // TODO: test call to pushJob
  test("merge A from B", async ({ fixtures }) => {
    const bottleA = await fixtures.Bottle({ totalTastings: 1 });
    await fixtures.Tasting({ bottleId: bottleA.id });
    const bottleB = await fixtures.Bottle();
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.merge(
      {
        bottle: bottleA.id,
        other: bottleB.id,
        direction: "mergeFrom",
      },
      { context: { user: modUser } }
    );

    expect(data.id).toEqual(bottleA.id);
  });
});
