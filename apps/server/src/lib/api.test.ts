import { db } from "../db";
import { profileVisible } from "./api";

describe("profileVisible", () => {
  test("not private", async ({ defaults, fixtures }) => {
    const user = await fixtures.User({ private: false });
    const rv = await profileVisible(db, user, defaults.user);
    expect(rv).toBe(true);
  });

  test("not logged in", async ({ fixtures }) => {
    const user = await fixtures.User({ private: true });
    const rv = await profileVisible(db, user, null);
    expect(rv).toBe(false);
  });

  test("self", async ({ fixtures }) => {
    const user = await fixtures.User({ private: true });
    const rv = await profileVisible(db, user, user);
    expect(rv).toBe(true);
  });

  test("not friends", async ({ defaults, fixtures }) => {
    const user = await fixtures.User({ private: true });
    const rv = await profileVisible(db, user, defaults.user);
    expect(rv).toBe(false);
  });

  test("not approved", async ({ defaults, fixtures }) => {
    const user = await fixtures.User({ private: true });
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: user.id,
      status: "pending",
    });
    const rv = await profileVisible(db, user, defaults.user);
    expect(rv).toBe(false);
  });

  test("friends", async ({ defaults, fixtures }) => {
    const user = await fixtures.User({ private: true });
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: user.id,
      status: "following",
    });
    const rv = await profileVisible(db, user, defaults.user);
    expect(rv).toBe(true);
  });
});
