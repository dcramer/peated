import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import buildFastify from "../app";
import { db } from "../db";
import { bottles } from "../db/schema";
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
  const bottle = await Fixtures.Bottle();
  const response = await app.inject({
    method: "PUT",
    url: `/bottles/${bottle.id}`,
    payload: {
      name: "Delicious Wood",
    },
    headers: await Fixtures.AuthenticatedHeaders(),
  });

  expect(response).toRespondWith(403);
});

test("no changes", async () => {
  const bottle = await Fixtures.Bottle();
  const response = await app.inject({
    method: "PUT",
    url: `/bottles/${bottle.id}`,
    payload: {},
    headers: await Fixtures.AuthenticatedHeaders({
      mod: true,
    }),
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));

  expect(bottle).toEqual(newBottle);
});

test("edits a new bottle with new name param", async () => {
  const bottle = await Fixtures.Bottle();
  const response = await app.inject({
    method: "PUT",
    url: `/bottles/${bottle.id}`,
    payload: {
      name: "Delicious Wood",
    },
    headers: await Fixtures.AuthenticatedHeaders({ mod: true }),
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [bottle2] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));

  expect(omit(bottle, "name")).toEqual(omit(bottle2, "name"));
  expect(bottle2.name).toBe("Delicious Wood");
});

test("clears category", async () => {
  const bottle = await Fixtures.Bottle({ category: "single_malt" });
  const response = await app.inject({
    method: "PUT",
    url: `/bottles/${bottle.id}`,
    payload: {
      category: null,
    },
    headers: await Fixtures.AuthenticatedHeaders({ mod: true }),
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [bottle2] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));

  expect(omit(bottle, "category")).toEqual(omit(bottle2, "category"));
  expect(bottle2.category).toBe(null);
});

test("requires age with matching name", async () => {
  const bottle = await Fixtures.Bottle({ statedAge: null });
  const response = await app.inject({
    method: "PUT",
    url: `/bottles/${bottle.id}`,
    payload: {
      name: "Delicious 10-year-old",
    },
    headers: await Fixtures.AuthenticatedHeaders({ mod: true }),
  });

  expect(response).toRespondWith(400);
});

test("manipulates name to conform with age", async () => {
  const bottle = await Fixtures.Bottle();
  const response = await app.inject({
    method: "PUT",
    url: `/bottles/${bottle.id}`,
    payload: {
      name: "Delicious 10",
      statedAge: 10,
    },
    headers: await Fixtures.AuthenticatedHeaders({ mod: true }),
  });

  expect(response).toRespondWith(200);
  const [bottle2] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));

  expect(omit(bottle, "name", "statedAge")).toEqual(
    omit(bottle2, "name", "statedAge"),
  );
  expect(bottle2.statedAge).toBe(10);
  expect(bottle2.name).toBe("Delicious 10-year-old");
});
