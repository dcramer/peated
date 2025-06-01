import { routerClient } from "@peated/server/orpc/router";

describe("GET /smws/distillers", () => {
  test("lists distillers", async ({ fixtures }) => {
    const nikka = await fixtures.Entity({
      name: "Nikka",
    });
    await fixtures.EntityAlias({
      entityId: nikka.id,
      name: "Nikka Coffey Grain",
    });

    const macallan = await fixtures.Entity({
      name: "Macallan",
    });

    const user = await fixtures.User({ mod: true });
    const { results } = await routerClient.smws.distillerList(
      {},
      { context: { user } }
    );

    expect(results.length).toBe(2);
  });
});
