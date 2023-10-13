import { db } from "@peated/shared/db";
import { entities } from "@peated/shared/db/schema";
import { eq } from "drizzle-orm";
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

test("name is required", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/entities",
    payload: {},
    headers: await Fixtures.AuthenticatedHeaders({ mod: true }),
  });

  expect(response).toRespondWith(400);
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
