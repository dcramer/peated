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
  const bottle = await Fixtures.Bottle();
  await Fixtures.StorePrice({
    bottleId: bottle.id,
  });

  const response = await app.inject({
    method: "GET",
    url: `/bottles/${bottle.id}/prices`,
  });

  expect(response).toRespondWith(200);
});
