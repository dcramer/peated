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
