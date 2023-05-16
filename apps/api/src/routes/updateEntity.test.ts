import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import buildFastify from "../app";
import { db } from "../db";
import { entities } from "../db/schema";
import { omit } from "../lib/filter";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    app.close();
  };
});

test("must be mod", async () => {
  const entity = await Fixtures.Entity();
  const response = await app.inject({
    method: "PUT",
    url: `/entities/${entity.id}`,
    payload: {
      name: "Delicious Wood",
    },
    headers: await Fixtures.AuthenticatedHeaders(),
  });

  expect(response).toRespondWith(403);
});

test("no changes", async () => {
  const entity = await Fixtures.Entity();
  const response = await app.inject({
    method: "PUT",
    url: `/entities/${entity.id}`,
    payload: {},
    headers: await Fixtures.AuthenticatedHeaders({
      mod: true,
    }),
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(entity).toEqual(newEntity);
});

test("can change name", async () => {
  const entity = await Fixtures.Entity();
  const response = await app.inject({
    method: "PUT",
    url: `/entities/${entity.id}`,
    payload: {
      name: "Delicious Wood",
    },
    headers: await Fixtures.AuthenticatedHeaders({
      mod: true,
    }),
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(omit(entity, "name")).toEqual(omit(newEntity, "name"));
  expect(newEntity.name).toBe("Delicious Wood");
});

test("can change country", async () => {
  const entity = await Fixtures.Entity();
  const response = await app.inject({
    method: "PUT",
    url: `/entities/${entity.id}`,
    payload: {
      country: "Scotland",
    },
    headers: await Fixtures.AuthenticatedHeaders({
      mod: true,
    }),
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(omit(entity, "country")).toEqual(omit(newEntity, "country"));
  expect(newEntity.country).toBe("Scotland");
});

test("can change region", async () => {
  const entity = await Fixtures.Entity();
  const response = await app.inject({
    method: "PUT",
    url: `/entities/${entity.id}`,
    payload: {
      region: "Islay",
    },
    headers: await Fixtures.AuthenticatedHeaders({
      mod: true,
    }),
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(omit(entity, "region")).toEqual(omit(newEntity, "region"));
  expect(newEntity.region).toBe("Islay");
});

test("can change type", async () => {
  const entity = await Fixtures.Entity();
  const response = await app.inject({
    method: "PUT",
    url: `/entities/${entity.id}`,
    payload: {
      type: ["distiller"],
    },
    headers: await Fixtures.AuthenticatedHeaders({
      mod: true,
    }),
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(omit(entity, "type")).toEqual(omit(newEntity, "type"));
  expect(newEntity.type).toEqual(["distiller"]);
});
