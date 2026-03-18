import { db } from "../db";
import { createAccessToken, createUser, getUserFromHeader } from "./auth";

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

test("gets user from a valid authorization header", async ({ fixtures }) => {
  const user = await fixtures.User();
  const token = await createAccessToken(user);

  await expect(getUserFromHeader(`Bearer ${token}`)).resolves.toMatchObject({
    id: user.id,
  });
});

test("returns null for an invalid authorization header token", async () => {
  await expect(getUserFromHeader("Bearer invalid-token")).resolves.toBeNull();
});
