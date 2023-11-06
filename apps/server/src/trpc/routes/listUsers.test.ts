import type { FastifyInstance } from "fastify";
import buildFastify from "../app";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    app.close();
  };
});

test("lists users needs a query", async () => {
  const user2 = await Fixtures.User();

  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(0);
});

test("lists users needs a query", async () => {
  const user2 = await Fixtures.User({ displayName: "David George" });

  const response = await app.inject({
    method: "GET",
    url: "/users",
    query: {
      query: "david",
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(1);
  expect(results[0].id).toBe(user2.id);
});

test("lists users requires auth", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/users",
  });

  expect(response).toRespondWith(401);
});
