import { db } from "../db";
import { createUser } from "./auth";

test("creates user with no username conflict", async () => {
  const data = {
    username: "thebert",
    email: "bert@example.com",
  };

  const user = await createUser(db, data);
  expect(user.id).toBeDefined();
  expect(user.username).toEqual("thebert");
  expect(user.email).toEqual("bert@example.com");
});

test("creates user with username conflict", async ({ fixtures }) => {
  const existingUser = await fixtures.User({
    username: "thebert",
  });

  const data = {
    username: "thebert",
    email: "bert@example.com",
  };

  const user = await createUser(db, data);
  expect(user.id).not.toEqual(existingUser.id);
  expect(user.username).not.toEqual("thebert");
  expect(user.username.startsWith("thebert-")).toBe(true);
});
