import { db } from "../db";
import * as Fixtures from "../lib/test/fixtures";
import { fixBottleName, profileVisible } from "./api";

describe("fixBottleName", () => {
  test("just the age", async () => {
    const rv = fixBottleName("10", 10);
    expect(rv).toBe("10-year-old");
  });

  test("age suffix", async () => {
    const rv = fixBottleName("Delicious 10", 10);
    expect(rv).toBe("Delicious 10-year-old");
  });

  test("age prefix", async () => {
    const rv = fixBottleName("10 Wood", 10);
    expect(rv).toBe("10-year-old Wood");
  });

  test("casing", async () => {
    const rv = fixBottleName("10-YEAR-OLD Wood", 10);
    expect(rv).toBe("10-year-old Wood");
  });

  test("plural to singular", async () => {
    const rv = fixBottleName("10-years-old Wood", 10);
    expect(rv).toBe("10-year-old Wood");
  });

  test("spacing", async () => {
    const rv = fixBottleName("10 years old Wood", 10);
    expect(rv).toBe("10-year-old Wood");

    const rv2 = fixBottleName("10 year old Wood", 10);
    expect(rv2).toBe("10-year-old Wood");
  });

  test("age without age", async () => {
    const rv = fixBottleName("10");
    expect(rv).toBe("10");
  });
});

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
