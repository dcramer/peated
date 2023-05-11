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

test("lists tastings", async () => {
  await Fixtures.Tasting();
  await Fixtures.Tasting();

  const response = await app.inject({
    method: "GET",
    url: "/tastings",
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.length).toBe(2);
});

test("lists tastings with bottle", async () => {
  const bottle = await Fixtures.Bottle();
  const tasting = await Fixtures.Tasting({ bottleId: bottle.id });
  await Fixtures.Tasting();

  const response = await app.inject({
    method: "GET",
    url: "/tastings",
    query: {
      bottle: `${bottle.id}`,
    },
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.length).toBe(1);
  expect(data[0].id).toBe(tasting.id);
});

test("lists tastings with user", async () => {
  const tasting = await Fixtures.Tasting({
    createdById: DefaultFixtures.user.id,
  });
  await Fixtures.Tasting();

  const response = await app.inject({
    method: "GET",
    url: "/tastings",
    query: {
      user: `${DefaultFixtures.user.id}`,
    },
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.length).toBe(1);
  expect(data[0].id).toBe(tasting.id);
});
