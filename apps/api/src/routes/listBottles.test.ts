import buildFastify from "../app";
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
  await Fixtures.Bottle({ name: "Delicious Wood" });
  await Fixtures.Bottle({ name: "Something Else" });

  const response = await app.inject({
    method: "GET",
    url: "/bottles",
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(2);
});

test("lists bottles with query", async () => {
  const bottle1 = await Fixtures.Bottle({ name: "Delicious Wood" });
  await Fixtures.Bottle({ name: "Something Else" });

  let response = await app.inject({
    method: "GET",
    url: "/bottles",
    query: {
      query: "wood",
    },
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(1);
  expect(results[0].id).toBe(bottle1.id);
});

test("lists bottles with distiller", async () => {
  const distiller1 = await Fixtures.Entity();
  const bottle1 = await Fixtures.Bottle({
    name: "Delicious Wood",
    distillerIds: [distiller1.id],
  });
  await Fixtures.Bottle({ name: "Something Else" });

  let response = await app.inject({
    method: "GET",
    url: "/bottles",
    query: {
      distiller: `${distiller1.id}`,
    },
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(1);
  expect(results[0].id).toBe(bottle1.id);
});

test("lists bottles with brand", async () => {
  const brand1 = await Fixtures.Entity();
  const bottle1 = await Fixtures.Bottle({
    name: "Delicious Wood",
    brandId: brand1.id,
  });
  await Fixtures.Bottle({ name: "Something Else" });

  let response = await app.inject({
    method: "GET",
    url: "/bottles",
    query: {
      brand: `${brand1.id}`,
    },
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(1);
  expect(results[0].id).toBe(bottle1.id);
});
