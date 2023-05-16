import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
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
