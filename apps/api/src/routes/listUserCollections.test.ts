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
test("cannot list private without friend", async () => {
  const otherUser = await Fixtures.User({ private: true });
  const response = await app.inject({
    method: "GET",
    url: `/users/${otherUser.id}/collections`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(400);
});

test("can list private with friend", async () => {
  const otherUser = await Fixtures.User({ private: true });
  await Fixtures.Follow({
    fromUserId: DefaultFixtures.user.id,
    toUserId: otherUser.id,
    status: "following",
  });
  const response = await app.inject({
    method: "GET",
    url: `/users/${otherUser.id}/collections`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
});

test("can list public without friend", async () => {
  const otherUser = await Fixtures.User({ private: false });
  const response = await app.inject({
    method: "GET",
    url: `/users/${otherUser.id}/collections`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
});
