import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("lists badges", async () => {
  await Fixtures.Badge();
  await Fixtures.Badge();

  const caller = appRouter.createCaller({
    user: null,
  });
  const { results } = await caller.badgeList();
  expect(results.length).toBe(2);
});
