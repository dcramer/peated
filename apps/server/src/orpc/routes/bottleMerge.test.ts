import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "../router";

describe("POST /bottles/:bottle/merge-targets", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.bottleMerge(
        {
          bottle: 1,
          other: 2,
        },
        { context: { user: null } },
      ),
    );
    expect(err).toMatchInlineSnapshot();
  });

  test("requires mod", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false, admin: false });
    const err = await waitError(
      routerClient.bottleMerge(
        {
          bottle: 1,
          other: 2,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot();
  });

  // TODO: test call to pushJob
  test("merge A into B", async ({ fixtures }) => {
    const bottleA = await fixtures.Bottle({ totalTastings: 1 });
    await fixtures.Tasting({ bottleId: bottleA.id });
    const bottleB = await fixtures.Bottle();
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottleMerge(
      {
        bottle: bottleA.id,
        other: bottleB.id,
        direction: "mergeInto",
      },
      { context: { user: modUser } },
    );

    expect(data.id).toEqual(bottleB.id);
  });

  // TODO: test call to pushJob
  test("merge A from B", async ({ fixtures }) => {
    const bottleA = await fixtures.Bottle({ totalTastings: 1 });
    await fixtures.Tasting({ bottleId: bottleA.id });
    const bottleB = await fixtures.Bottle();
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottleMerge(
      {
        bottle: bottleA.id,
        other: bottleB.id,
        direction: "mergeFrom",
      },
      { context: { user: modUser } },
    );

    expect(data.id).toEqual(bottleA.id);
  });
});
