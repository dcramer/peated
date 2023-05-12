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

test("lists users", async () => {
  const user2 = await Fixtures.User();

  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.length).toBe(2);
});

test("lists users requires auth", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/users",
  });

  expect(response).toRespondWith(401);
});
