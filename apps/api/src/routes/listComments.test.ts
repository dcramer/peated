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

test("lists comments", async () => {
  const comment = await Fixtures.Comment();
  await Fixtures.Comment();

  const response = await app.inject({
    method: "GET",
    url: "/comments",
    query: {
      tasting: `${comment.tastingId}`,
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const { results } = JSON.parse(response.payload);
  expect(results.length).toBe(1);
  expect(results[0].id).toBe(`${comment.id}`);
});
