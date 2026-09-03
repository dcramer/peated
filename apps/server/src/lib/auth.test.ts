import config from "@peated/server/config";
import jsonwebtoken from "jsonwebtoken";
import { db } from "../db";
import {
  createAccessToken,
  createUser,
  generateMagicLink,
  getUserFromHeader,
  signToken,
  verifyToken,
} from "./auth";

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

test("does not accept a magic link as an API access token", async ({
  fixtures,
}) => {
  const user = await fixtures.User();
  const { token } = await generateMagicLink(user);

  await expect(getUserFromHeader(`Bearer ${token}`)).resolves.toBeNull();
});

for (const purpose of ["recovery", "email-verification"] as const) {
  test(`does not accept a ${purpose} token as an API access token`, async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const token = await signToken({ id: user.id, email: user.email }, purpose);

    await expect(getUserFromHeader(`Bearer ${token}`)).resolves.toBeNull();
  });
}

test("does not accept tokens without a purpose", async ({ fixtures }) => {
  const user = await fixtures.User();
  const token = jsonwebtoken.sign({ id: user.id }, config.JWT_SECRET, {
    expiresIn: "7d",
  });

  await expect(getUserFromHeader(`Bearer ${token}`)).resolves.toBeNull();
});

test.each(["magic-link", "recovery", "webauthn-challenge"] as const)(
  "%s JWTs expire after ten minutes",
  async (purpose) => {
    const token = await signToken(
      { iat: Math.floor(Date.now() / 1000) - 601 },
      purpose,
    );

    await expect(verifyToken(token, purpose)).rejects.toThrow("jwt expired");
  },
);
