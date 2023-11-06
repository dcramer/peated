import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
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

test("must be mod", async () => {
  const entity = await Fixtures.Entity();
  const response = await app.inject({
    method: "POST",
    url: `/entities/${entity.id}/merge`,
    payload: {
      entityId: entity.id,
      direction: "mergeInto",
    },
    headers: await Fixtures.AuthenticatedHeaders(),
  });

  expect(response).toRespondWith(403);
});

test("merge A into B", async () => {
  const entityA = await Fixtures.Entity({ totalTastings: 1, totalBottles: 2 });
  const entityB = await Fixtures.Entity({ totalTastings: 3, totalBottles: 1 });
  const response = await app.inject({
    method: "POST",
    url: `/entities/${entityA.id}/merge`,
    payload: {
      entityId: entityB.id,
      direction: "mergeInto",
    },
    headers: await Fixtures.AuthenticatedHeaders({
      mod: true,
    }),
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toEqual(entityB.id);

  const [newEntityA] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityA.id));
  expect(newEntityA).toBeUndefined();

  const [newEntityB] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityB.id));
  expect(newEntityB).toBeDefined();
  expect(newEntityB.totalTastings).toEqual(4);
  expect(newEntityB.totalBottles).toEqual(3);
});

test("merge A from B", async () => {
  const entityA = await Fixtures.Entity({ totalTastings: 1, totalBottles: 2 });
  const entityB = await Fixtures.Entity({ totalTastings: 3, totalBottles: 1 });
  const response = await app.inject({
    method: "POST",
    url: `/entities/${entityA.id}/merge`,
    payload: {
      entityId: entityB.id,
      direction: "mergeFrom",
    },
    headers: await Fixtures.AuthenticatedHeaders({
      mod: true,
    }),
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toEqual(entityA.id);

  const [newEntityA] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityA.id));
  expect(newEntityA).toBeDefined();
  expect(newEntityA.totalTastings).toEqual(4);
  expect(newEntityA.totalBottles).toEqual(3);

  const [newEntityB] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityB.id));
  expect(newEntityB).toBeUndefined();
});
