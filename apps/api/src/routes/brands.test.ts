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

test("lists brands", async () => {
  await Fixtures.Brand();
  await Fixtures.Brand();

  let response = await app.inject({
    method: "GET",
    url: "/brands",
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.length).toBe(2);
});

test("lists brands hides private", async () => {
  const brand = await Fixtures.Brand();
  await Fixtures.Brand({ public: false });

  let response = await app.inject({
    method: "GET",
    url: "/brands",
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.length).toBe(1);
  expect(data[0].id).toBe(brand.id);
});

test("get brand", async () => {
  const brand = await Fixtures.Brand();

  let response = await app.inject({
    method: "GET",
    url: `/brands/${brand.id}`,
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.id).toBe(brand.id);
});

test("creates a new brand", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/brands",
    payload: {
      name: "Macallan",
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const brand = await prisma.brand.findUniqueOrThrow({
    where: { id: data.id },
  });
  expect(brand.name).toEqual("Macallan");
  expect(brand.createdById).toEqual(DefaultFixtures.user.id);
  expect(brand.public).toEqual(false);
});

test("creates a new public brand as admin", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/brands",
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

  const brand = await prisma.brand.findUniqueOrThrow({
    where: { id: data.id },
  });
  expect(brand.public).toEqual(true);
});
