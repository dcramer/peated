import buildFastify from "../app";
import { prisma } from "../lib/db";
import * as Fixtures from "../lib/test/fixtures";
import { FastifyInstance } from "fastify";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();
});

afterAll(async () => {
  await app.close();
});

test("lists tastings", async () => {
  await Fixtures.Tasting();
  await Fixtures.Tasting();

  let response = await app.inject({
    method: "GET",
    url: "/tastings",
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.length).toBe(2);
});

test("lists tastings with bottle", async () => {
  const bottle = await Fixtures.Bottle();
  const tasting = await Fixtures.Tasting({ bottleId: bottle.id });
  await Fixtures.Tasting();

  let response = await app.inject({
    method: "GET",
    url: "/tastings",
    query: {
      bottle: `${bottle.id}`,
    },
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.length).toBe(1);
  expect(data[0].id).toBe(tasting.id);
});

test("lists tastings with bottle", async () => {
  const bottle = await Fixtures.Bottle();
  const tasting = await Fixtures.Tasting({ userId: DefaultFixtures.user.id });
  await Fixtures.Tasting();

  let response = await app.inject({
    method: "GET",
    url: "/tastings",
    query: {
      user: `${DefaultFixtures.user.id}`,
    },
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.length).toBe(1);
  expect(data[0].id).toBe(tasting.id);
});

test("get tasting", async () => {
  const tasting = await Fixtures.Tasting();

  let response = await app.inject({
    method: "GET",
    url: `/tastings/${tasting.id}`,
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.id).toBe(tasting.id);
});

test("creates a new tasting with minimal params", async () => {
  const bottle = await Fixtures.Bottle();
  const response = await app.inject({
    method: "POST",
    url: "/tastings",
    payload: {
      bottle: bottle.id,
      rating: 3.5,
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const tasting = await prisma.tasting.findUniqueOrThrow({
    where: { id: data.id },
  });
  expect(tasting.bottleId).toEqual(bottle.id);
  expect(tasting.userId).toEqual(DefaultFixtures.user.id);
  expect(tasting.rating).toEqual(3.5);
  expect(tasting.tastingNotes).toBeNull();
});

test("creates a new tasting with tags", async () => {
  const bottle = await Fixtures.Bottle();
  const response = await app.inject({
    method: "POST",
    url: "/tastings",
    payload: {
      bottle: bottle.id,
      rating: 3.5,
      tags: ["cherry", "PEAT"],
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const tasting = await prisma.tasting.findUniqueOrThrow({
    where: { id: data.id },
  });
  expect(tasting.bottleId).toEqual(bottle.id);
  expect(tasting.userId).toEqual(DefaultFixtures.user.id);
  expect(tasting.tags).toEqual(["cherry", "peat"]);
});
