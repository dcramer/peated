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

test("lists brands", async () => {
  const brand = await Fixtures.Brand();
  const brand2 = await Fixtures.Brand();

  let response = await app.inject({
    method: "GET",
    url: "/brands",
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.length).toBe(2);
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
