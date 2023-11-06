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

test("lists friends", async () => {
  const follow1 = await Fixtures.Follow({
    fromUserId: DefaultFixtures.user.id,
  });
  await Fixtures.Follow();

  const response = await app.inject({
    method: "GET",
    url: "/friends",
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(1);
  expect(results[0].user.id).toBe(follow1.toUserId);
});

test("requires auth", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/friends",
  });

  expect(response).toRespondWith(401);
});
