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

test("lists tags", async () => {
  const bottle = await Fixtures.Bottle({
    name: "Delicious Wood",
  });
  await Fixtures.Tasting({
    bottleId: bottle.id,
    tags: ["fruity", "caramel"],
    rating: 5,
  });
  await Fixtures.Tasting({
    bottleId: bottle.id,
    tags: ["dried fruits", "caramel"],
    rating: 5,
  });
  await Fixtures.Tasting({
    bottleId: bottle.id,
    tags: ["dried fruits", "caramel"],
    rating: 5,
  });

  const response = await app.inject({
    method: "GET",
    url: `/bottles/${bottle.id}/suggestedTags`,
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(3);
  expect(results).toEqual([
    { name: "caramel", count: 3 },
    { name: "dried fruits", count: 2 },
    { name: "fruity", count: 1 },
  ]);
});
