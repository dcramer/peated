import buildFastify from "../app";
import * as Fixtures from "../lib/test/fixtures";
import { FastifyInstance } from "fastify";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    app.close();
  };
});

test("lists users", async () => {
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

test("lists users requires auth", async () => {
  let response = await app.inject({
    method: "GET",
    url: "/users",
  });

  expect(response).toRespondWith(401);
});
