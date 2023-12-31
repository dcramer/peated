import * as Fixtures from "../../lib/test/fixtures";
import { createCaller } from "../router";

test("lists flights", async () => {
  const flight1 = await Fixtures.Flight({
    createdById: DefaultFixtures.user.id,
  });
  await Fixtures.Flight();

  const caller = createCaller({ user: DefaultFixtures.user });
  const { results } = await caller.flightList();

  expect(results.length).toBe(1);
  expect(results[0].id).toBe(flight1.publicId);
});
