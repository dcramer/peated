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

test("lists bottles", async () => {
  const bottle1 = await Fixtures.Bottle({ name: "Delicious Wood" });
  await Fixtures.Bottle({ name: "Something Else" });

  let response = await app.inject({
    method: "GET",
    url: "/bottles",
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.length).toBe(2);

  response = await app.inject({
    method: "GET",
    url: "/bottles?query=delicious",
  });

  expect(response).toRespondWith(200);
  data = JSON.parse(response.payload);
  expect(data.length).toBe(1);
  expect(data[0].id).toBe(bottle1.id);
});

test("get bottle", async () => {
  const bottle1 = await Fixtures.Bottle({ name: "Delicious Wood" });
  await Fixtures.Bottle({ name: "Something Else" });

  let response = await app.inject({
    method: "GET",
    url: `/bottles/${bottle1.id}`,
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.id).toBe(bottle1.id);
});

test("creates a new bottle with minimal params", async () => {
  const brand = await Fixtures.Brand();
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      brand: brand.id,
    },
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const bottle = await prisma.bottle.findUniqueOrThrow({
    where: { id: data.id },
  });
  expect(bottle.name).toEqual("Delicious Wood");
  expect(bottle.brandId).toBeDefined();
  expect(bottle.distillerId).toBeNull();
  expect(bottle.abv).toBeNull();
  expect(bottle.statedAge).toBeNull();
  expect(bottle.series).toBeNull();
});

test("creates a new bottle with all params", async () => {
  const brand = await Fixtures.Brand();
  const distiller = await Fixtures.Distiller();
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      brand: brand.id,
      distiller: distiller.id,
      series: "Super Delicious",
      abv: 0.45,
      statedAge: 12,
    },
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const bottle = await prisma.bottle.findUniqueOrThrow({
    where: { id: data.id },
  });
  expect(bottle.name).toEqual("Delicious Wood");
  expect(bottle.brandId).toEqual(brand.id);
  expect(bottle.distillerId).toEqual(distiller.id);
  expect(bottle.abv).toEqual(0.45);
  expect(bottle.statedAge).toEqual(12);
  expect(bottle.series).toEqual("Super Delicious");
});

test("creates a new bottle with invalid brandId", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      brand: 5,
    },
  });

  expect(response).toRespondWith(400);
});

test("creates a new bottle with existing branbd name", async () => {
  const brand = await Fixtures.Brand();
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      brand: {
        name: brand.name,
        country: brand.country,
      },
    },
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const bottle = await prisma.bottle.findUniqueOrThrow({
    where: { id: data.id },
  });
  expect(bottle.name).toEqual("Delicious Wood");
  expect(bottle.brandId).toEqual(brand.id);
});

test("creates a new bottle with new brand name", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      brand: {
        name: "Hard Knox",
        country: "Scotland",
      },
    },
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const bottle = await prisma.bottle.findUniqueOrThrow({
    where: { id: data.id },
  });
  expect(bottle.name).toEqual("Delicious Wood");
  expect(bottle.brandId).toBeDefined();
});
