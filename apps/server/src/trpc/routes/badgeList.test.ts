import * as Fixtures from "../../lib/test/fixtures";
import { createCaller } from "../router";

test("lists badges", async () => {
  await Fixtures.Badge();
  await Fixtures.Badge();

  const caller = createCaller({
    user: null,
  });
  const { results } = await caller.badgeList();
  expect(results.length).toBe(2);
});
