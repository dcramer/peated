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

test("lists followers", async () => {
  const follow1 = await Fixtures.Follow({
    toUserId: DefaultFixtures.user.id,
  });
  const follow2 = await Fixtures.Follow({
    toUserId: DefaultFixtures.user.id,
  });
  await Fixtures.Follow();

  const response = await app.inject({
    method: "GET",
    url: "/followers",
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(2);
});

test("lists follow requests requires auth", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/followers",
  });

  expect(response).toRespondWith(401);
});
