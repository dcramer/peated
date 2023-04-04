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
  const bottle1 = await Fixtures.Bottle({ name: "Delicious Wood" });
  const bottle2 = await Fixtures.Bottle({ name: "Something Else" });

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

test("creates a new bottle with producerId", async () => {
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
  expect(data.name).toEqual("Delicious Wood");
  expect(data.producerId).toEqual(producer.id);
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
  expect(data.name).toEqual("Delicious Wood");
  expect(data.producerId).toEqual(producer.id);
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
  expect(data.name).toEqual("Delicious Wood");
  expect(data.producerId).toBeDefined();
});
