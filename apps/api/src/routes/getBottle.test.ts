import { FastifyInstance } from "fastify";
import buildFastify from "../app";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();
});

afterAll(async () => {
  await app.close();
});

test("get bottle", async () => {
  const bottle1 = await Fixtures.Bottle({ name: "Delicious Wood" });
  await Fixtures.Bottle({ name: "Something Else" });

  const response = await app.inject({
    method: "GET",
    url: `/bottles/${bottle1.id}`,
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBe(bottle1.id);
});
