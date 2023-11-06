import { db } from "../db";
import * as Fixtures from "../lib/test/fixtures";
import { createUser } from "./auth";

test("creates user with no username conflict", async () => {
  const data = {
    displayName: "Bert McCracken",
    username: "thebert",
    email: "bert@example.com",
  };

  const user = await createUser(db, data);
  expect(user.id).toBeDefined();
  expect(user.username).toEqual("thebert");
  expect(user.displayName).toEqual("Bert McCracken");
  expect(user.email).toEqual("bert@example.com");
});

test("creates user with username conflict", async () => {
  const existingUser = await Fixtures.User({
    username: "thebert",
  });

  const data = {
    displayName: "Bert McCracken",
    username: "thebert",
    email: "bert@example.com",
  };

  const user = await createUser(db, data);
  expect(user.id).not.toEqual(existingUser.id);
  expect(user.username).not.toEqual("thebert");
  expect(user.username.indexOf("thebert-")).toEqual(0);
});
