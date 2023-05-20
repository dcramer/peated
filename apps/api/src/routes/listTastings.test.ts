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

test("lists tastings", async () => {
  await Fixtures.Tasting();
  await Fixtures.Tasting();

  const response = await app.inject({
    method: "GET",
    url: "/tastings",
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(2);
});

test("lists tastings with bottle", async () => {
  const bottle = await Fixtures.Bottle();
  const tasting = await Fixtures.Tasting({ bottleId: bottle.id });
  await Fixtures.Tasting();

  const response = await app.inject({
    method: "GET",
    url: "/tastings",
    query: {
      bottle: `${bottle.id}`,
    },
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(1);
  expect(results[0].id).toEqual(tasting.id);
});

test("lists tastings with user", async () => {
  const tasting = await Fixtures.Tasting({
    createdById: DefaultFixtures.user.id,
  });
  await Fixtures.Tasting();

  const response = await app.inject({
    method: "GET",
    url: "/tastings",
    query: {
      user: `${DefaultFixtures.user.id}`,
    },
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(1);
  expect(results[0].id).toEqual(tasting.id);
});

test("lists tastings filter friends unauthenticated", async () => {
  await Fixtures.Tasting();
  await Fixtures.Tasting();

  const response = await app.inject({
    method: "GET",
    url: "/tastings",
    query: {
      filter: "friends",
    },
  });

  expect(response).toRespondWith(401);
});

test("lists tastings filter friends", async () => {
  await Fixtures.Tasting();
  await Fixtures.Tasting();

  const otherUser = await Fixtures.User();
  await Fixtures.Follow({
    fromUserId: DefaultFixtures.user.id,
    toUserId: otherUser.id,
    status: "following",
  });
  const lastTasting = await Fixtures.Tasting({ createdById: otherUser.id });

  const response = await app.inject({
    method: "GET",
    url: "/tastings",
    query: {
      filter: "friends",
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(1);
  expect(results[0].id).toEqual(lastTasting.id);
});
