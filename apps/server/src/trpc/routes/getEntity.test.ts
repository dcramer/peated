import type { FastifyInstance } from "fastify";
import buildFastify from "../app";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    await app.close();
  };
});

test("get entity", async () => {
  const brand = await Fixtures.Entity();

  const response = await app.inject({
    method: "GET",
    url: `/entities/${brand.id}`,
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBe(brand.id);
});
