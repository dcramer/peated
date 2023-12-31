import * as Fixtures from "../../lib/test/fixtures";
import { createCaller } from "../router";

test("lists entities", async () => {
  await Fixtures.Entity();
  await Fixtures.Entity();

  const caller = createCaller({ user: null });
  const { results } = await caller.entityList();

  expect(results.length).toBe(2);
});

test("lists users needs a query", async () => {
  await Fixtures.User();

  const caller = createCaller({ user: DefaultFixtures.user });
  const { results } = await caller.userList();

  expect(results.length).toBe(0);
});

test("lists users needs a query", async () => {
  const user2 = await Fixtures.User({ displayName: "David George" });

  const caller = createCaller({ user: DefaultFixtures.user });
  const { results } = await caller.userList({
    query: "david",
  });

  expect(results.length).toBe(1);
  expect(results[0].id).toBe(user2.id);
});

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  expect(() => caller.userList()).rejects.toThrowError(/UNAUTHORIZED/);
});
