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

test("lists followers", async () => {
  const follow1 = await Fixtures.Follow({
    toUserId: DefaultFixtures.user.id,
  });
  const follow2 = await Fixtures.Follow({
    toUserId: DefaultFixtures.user.id,
  });

  const response = await app.inject({
    method: "GET",
    url: "/users/me/followers",
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(2);
});

test("lists follow requests requires auth", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/users/me/followers",
  });

  expect(response).toRespondWith(401);
});

test("lists follow requests cannot query others", async () => {
  const user = await Fixtures.User();
  const otherUser = await Fixtures.User();

  const response = await app.inject({
    method: "GET",
    url: `/users/${otherUser.id}/followers`,
    headers: await Fixtures.AuthenticatedHeaders({ user }),
  });

  expect(response).toRespondWith(403);
});
