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

test("lists distillers", async () => {
  const distiller = await Fixtures.Distiller();
  const distiller2 = await Fixtures.Distiller();

  let response = await app.inject({
    method: "GET",
    url: "/distillers",
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.length).toBe(2);
});

test("lists distillers with query", async () => {
  const distiller = await Fixtures.Distiller({ name: "Macallan" });
  const distiller2 = await Fixtures.Distiller({ name: "Mars" });

  let response = await app.inject({
    method: "GET",
    url: "/distillers",
    query: {
      query: "mac",
    },
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.length).toBe(1);
  expect(data[0].id).toBe(distiller.id);
});

test("lists distillers hides private", async () => {
  const distiller = await Fixtures.Distiller();
  const distiller2 = await Fixtures.Distiller({ public: false });

  let response = await app.inject({
    method: "GET",
    url: "/distillers",
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.length).toBe(1);
  expect(data[0].id).toBe(distiller.id);
});

test("get distiller", async () => {
  const distiller = await Fixtures.Distiller();

  let response = await app.inject({
    method: "GET",
    url: `/distillers/${distiller.id}`,
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.id).toBe(distiller.id);
});

test("creates a new distiller", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/distillers",
    payload: {
      name: "Macallan",
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const distiller = await prisma.distiller.findUniqueOrThrow({
    where: { id: data.id },
  });
  expect(distiller.name).toEqual("Macallan");
  expect(distiller.createdById).toEqual(DefaultFixtures.user.id);
  expect(distiller.public).toEqual(false);
});

test("creates a new public distiller as admin", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/distillers",
    payload: {
      name: "Macallan",
    },
    headers: await Fixtures.AuthenticatedHeaders({
      user: await Fixtures.User({ admin: true }),
    }),
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const distiller = await prisma.distiller.findUniqueOrThrow({
    where: { id: data.id },
  });
  expect(distiller.public).toEqual(true);
});
