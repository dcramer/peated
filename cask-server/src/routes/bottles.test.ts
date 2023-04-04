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
  const producer = await Fixtures.Producer();
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      producer: producer.id,
    },
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const bottle = await prisma.bottle.findUniqueOrThrow({
    where: { id: data.id },
    include: {
      mashBill: true,
    },
  });
  expect(bottle.name).toEqual("Delicious Wood");
  expect(bottle.producerId).toEqual(producer.id);
  expect(bottle.bottlerId).toBeNull();
  expect(bottle.brandId).toBeNull();
  expect(bottle.abv).toBeNull();
  expect(bottle.statedAge).toBeNull();
  expect(bottle.vintageYear).toBeNull();
  expect(bottle.bottleYear).toBeNull();
  expect(bottle.series).toBeNull();
  expect(bottle.caskType).toBeNull();
  expect(bottle.caskNumber).toBeNull();
  expect(bottle.totalBottles).toBeNull();
  expect(bottle.mashBill).toBeNull();
});

test("creates a new bottle with all params", async () => {
  const producer = await Fixtures.Producer();
  const bottler = await Fixtures.Bottler();
  const brand = await Fixtures.Brand();
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      producer: producer.id,
      bottler: bottler.id,
      brand: brand.id,
      abv: 0.45,
      statedAge: 12,
      vintageYear: 1999,
      bottleYear: 2000,
      series: "Super Delicious",
      caskType: "Port",
      caskNumber: "6969",
      totalBottles: 10000,
      mashBill: { barley: 0.5, corn: 0.2, rye: 0.2, wheat: 0.1 },
    },
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const bottle = await prisma.bottle.findUniqueOrThrow({
    where: { id: data.id },
    include: {
      mashBill: true,
    },
  });
  expect(bottle.name).toEqual("Delicious Wood");
  expect(bottle.producerId).toEqual(producer.id);
  expect(bottle.bottlerId).toEqual(bottler.id);
  expect(bottle.brandId).toEqual(brand.id);
  expect(bottle.abv).toEqual(0.45);
  expect(bottle.statedAge).toEqual(12);
  expect(bottle.vintageYear).toEqual(1999);
  expect(bottle.bottleYear).toEqual(2000);
  expect(bottle.series).toEqual("Super Delicious");
  expect(bottle.caskType).toEqual("Port");
  expect(bottle.caskNumber).toEqual("6969");
  expect(bottle.totalBottles).toEqual(10000);
  expect(bottle.mashBill.barley).toEqual(0.5);
  expect(bottle.mashBill.corn).toEqual(0.2);
  expect(bottle.mashBill.rye).toEqual(0.2);
  expect(bottle.mashBill.wheat).toEqual(0.1);
});

test("creates a new bottle with invalid producerId", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      producer: 5,
    },
  });

  expect(response).toRespondWith(400);
});

test("creates a new bottle with existing producer name", async () => {
  const producer = await Fixtures.Producer();
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      producer: {
        name: producer.name,
        country: producer.country,
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
  expect(bottle.producerId).toEqual(producer.id);
});

test("creates a new bottle with new producer name", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      producer: {
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
  expect(bottle.producerId).toBeDefined();
});
