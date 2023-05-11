import { eq } from "drizzle-orm";
import buildFastify from "../app";
import { entities } from "../db/schema";
import * as Fixtures from "../lib/test/fixtures";
import { FastifyInstance } from "fastify";
import { db } from "../db";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();
});

afterAll(async () => {
  await app.close();
});

test("lists entities", async () => {
  await Fixtures.Entity();
  await Fixtures.Entity();

  let response = await app.inject({
    method: "GET",
    url: "/entities",
  });

  expect(response).toRespondWith(200);
  let { results } = JSON.parse(response.payload);
  expect(results.length).toBe(2);
});

test("get entity", async () => {
  const brand = await Fixtures.Entity();

  let response = await app.inject({
    method: "GET",
    url: `/entities/${brand.id}`,
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.id).toBe(brand.id);
});

test("creates a new entity", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/entities",
    payload: {
      name: "Macallan",
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [brand] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));
  expect(brand.name).toEqual("Macallan");
  expect(brand.createdById).toEqual(DefaultFixtures.user.id);
});
