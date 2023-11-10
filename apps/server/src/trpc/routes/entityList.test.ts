import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("lists entities", async () => {
  await Fixtures.Entity();
  await Fixtures.Entity();

  const caller = appRouter.createCaller({ user: null });
  const { results } = await caller.entityList();

  expect(results.length).toBe(2);
});
