import { routerClient } from "@peated/server/orpc/router";

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
  const { results } = await routerClient.misc.smwsDistillerList(
    {},
    { context: { user } },
  );

  expect(results.length).toBe(2);
});
