import { FastifyInstance } from "fastify";
import buildFastify from "../app";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    await app.close();
  };
});

test("get tasting", async () => {
  const tasting = await Fixtures.Tasting();

  const response = await app.inject({
    method: "GET",
    url: `/tastings/${tasting.id}`,
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBe(tasting.id);
});
