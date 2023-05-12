import { FastifyInstance } from "fastify";
import buildFastify from "../app";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    app.close();
  };
});

test("get user", async () => {
  const user = await Fixtures.User();

  const response = await app.inject({
    method: "GET",
    url: `/users/${user.id}`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBe(user.id);
});

test("get user:me", async () => {
  const response = await app.inject({
    method: "GET",
    url: `/users/me`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBe(DefaultFixtures.user.id);
});

test("get user requires auth", async () => {
  const response = await app.inject({
    method: "GET",
    url: `/users/${DefaultFixtures.user.id}`,
  });

  expect(response).toRespondWith(401);
});
