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

test("lists checkins", async () => {
  const checkin = await Fixtures.Checkin();
  const checkin2 = await Fixtures.Checkin();

  let response = await app.inject({
    method: "GET",
    url: "/checkins",
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.length).toBe(2);
});

test("get checkin", async () => {
  const checkin = await Fixtures.Checkin();

  let response = await app.inject({
    method: "GET",
    url: `/checkins/${checkin.id}`,
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.id).toBe(checkin.id);
});

test("creates a new checkin with minimal params", async () => {
  const bottle = await Fixtures.Bottle();
  const response = await app.inject({
    method: "POST",
    url: "/checkins",
    payload: {
      bottle: bottle.id,
      rating: 3.5,
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const checkin = await prisma.checkin.findUniqueOrThrow({
    where: { id: data.id },
  });
  expect(checkin.bottleId).toEqual(bottle.id);
  expect(checkin.userId).toEqual(DefaultFixtures.user.id);
  expect(checkin.rating).toEqual(3.5);
  expect(checkin.tastingNotes).toBeNull();
});

test("creates a new checkin with tags", async () => {
  const bottle = await Fixtures.Bottle();
  const response = await app.inject({
    method: "POST",
    url: "/checkins",
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

  const checkin = await prisma.checkin.findUniqueOrThrow({
    where: { id: data.id },
  });
  expect(checkin.bottleId).toEqual(bottle.id);
  expect(checkin.userId).toEqual(DefaultFixtures.user.id);
  expect(checkin.tags).toEqual(["cherry", "peat"]);
});
