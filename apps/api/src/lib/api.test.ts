import { db } from "../db";
import * as Fixtures from "../lib/test/fixtures";
import { profileVisible } from "./api";

describe("profileVisible", () => {
  test("not private", async () => {
    const user = await Fixtures.User({ private: false });
    const rv = await profileVisible(db, user, DefaultFixtures.user);
    expect(rv).toBe(true);
  });

  test("not logged in", async () => {
    const user = await Fixtures.User({ private: true });
    const rv = await profileVisible(db, user, null);
    expect(rv).toBe(false);
  });

  test("self", async () => {
    const user = await Fixtures.User({ private: true });
    const rv = await profileVisible(db, user, user);
    expect(rv).toBe(true);
  });

  test("not friends", async () => {
    const user = await Fixtures.User({ private: true });
    const rv = await profileVisible(db, user, DefaultFixtures.user);
    expect(rv).toBe(false);
  });

  test("not approved", async () => {
    const user = await Fixtures.User({ private: true });
    await Fixtures.Follow({
      fromUserId: DefaultFixtures.user.id,
      toUserId: user.id,
      status: "pending",
    });
    const rv = await profileVisible(db, user, DefaultFixtures.user);
    expect(rv).toBe(false);
  });

  test("friends", async () => {
    const user = await Fixtures.User({ private: true });
    await Fixtures.Follow({
      fromUserId: DefaultFixtures.user.id,
      toUserId: user.id,
      status: "following",
    });
    const rv = await profileVisible(db, user, DefaultFixtures.user);
    expect(rv).toBe(true);
  });
});
