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

test("lists tags", async () => {
  const bottle = await Fixtures.Bottle();
  const bottle2 = await Fixtures.Bottle({
    brandId: bottle.brandId,
  });
  await Fixtures.Tasting({
    bottleId: bottle.id,
    tags: ["solvent", "caramel"],
    rating: 5,
    createdById: DefaultFixtures.user.id,
  });
  await Fixtures.Tasting({
    bottleId: bottle.id,
    tags: ["caramel"],
    rating: 5,
    createdById: DefaultFixtures.user.id,
  });
  await Fixtures.Tasting({
    bottleId: bottle2.id,
    tags: ["cedar", "caramel"],
    rating: 5,
  });

  const response = await app.inject({
    method: "GET",
    url: `/users/me/tags`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results).toEqual([
    { tag: "caramel", count: 2 },
    { tag: "solvent", count: 1 },
  ]);
});

test("cannot list private without friend", async () => {
  const otherUser = await Fixtures.User({ private: true });
  const response = await app.inject({
    method: "GET",
    url: `/users/${otherUser.id}/tags`,
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
    url: `/users/${otherUser.id}/tags`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
});

test("can list public without friend", async () => {
  const otherUser = await Fixtures.User({ private: false });
  const response = await app.inject({
    method: "GET",
    url: `/users/${otherUser.id}/tags`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
});
