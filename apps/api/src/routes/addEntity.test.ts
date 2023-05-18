import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import buildFastify from "../app";
import { db } from "../db";
import { entities } from "../db/schema";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    await app.close();
  };
});

test("must be mod", async () => {
  const response = await app.inject({
    method: "POST",
    url: `/entities`,
    payload: {
      name: "Delicious Wood",
    },
    headers: await Fixtures.AuthenticatedHeaders(),
  });

  expect(response).toRespondWith(403);
});

test("creates a new entity", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/entities",
    payload: {
      name: "Macallan",
    },
    headers: await Fixtures.AuthenticatedHeaders({ mod: true }),
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [brand] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));
  expect(brand.name).toEqual("Macallan");
});

test("updates existing entity with new type", async () => {
  const entity = await Fixtures.Entity({
    type: ["distiller"],
  });

  const response = await app.inject({
    method: "POST",
    url: "/entities",
    payload: {
      name: entity.name,
      type: ["brand"],
    },
    headers: await Fixtures.AuthenticatedHeaders({ mod: true }),
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [brand] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));
  expect(brand.id).toEqual(entity.id);
  expect(brand.type).toEqual(["distiller", "brand"]);
});
