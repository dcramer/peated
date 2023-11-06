import type { FastifyInstance } from "fastify";
import buildFastify from "../app";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    app.close();
  };
});

test("lists flights", async () => {
  const flight1 = await Fixtures.Flight({
    createdById: DefaultFixtures.user.id,
  });
  await Fixtures.Flight();

  const response = await app.inject({
    method: "GET",
    url: "/flights",
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(1);
  expect(results[0].id).toBe(flight1.publicId);
});
