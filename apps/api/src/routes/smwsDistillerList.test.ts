import { createCaller } from "../trpc/router";

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

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const { results } = await caller.smwsDistillerList();

  expect(results.length).toBe(2);
});
