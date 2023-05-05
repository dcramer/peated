import buildFastify from "../app";
import { prisma } from "../lib/db";
import * as Fixtures from "../lib/test/fixtures";
import { FastifyInstance } from "fastify";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();
});

afterAll(async () => {
  await app.close();
});

test("lists distillers", async () => {
  const user2 = await Fixtures.User();

  let response = await app.inject({
    method: "GET",
    url: "/users",
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.length).toBe(2);
});

test("lists distillers requires auth", async () => {
  let response = await app.inject({
    method: "GET",
    url: "/users",
  });

  expect(response).toRespondWith(401);
});

test("get user", async () => {
  const user = await Fixtures.User();

  let response = await app.inject({
    method: "GET",
    url: `/users/${user.id}`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.id).toBe(user.id);
});

test("get user:me", async () => {
  let response = await app.inject({
    method: "GET",
    url: `/users/me`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.id).toBe(DefaultFixtures.user.id);
});

test("get user requires auth", async () => {
  let response = await app.inject({
    method: "GET",
    url: `/users/${DefaultFixtures.user.id}`,
  });

  expect(response).toRespondWith(401);
});
