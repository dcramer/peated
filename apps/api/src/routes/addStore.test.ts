import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { stores } from "~/db/schema";
import buildFastify from "../app";
import { db } from "../db";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    await app.close();
  };
});

test("requires admin", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/stores",
    payload: { type: "totalwines", name: "Total Wines" },
    headers: await Fixtures.AuthenticatedHeaders({ mod: true }),
  });

  expect(response).toRespondWith(403);
});

test("name is required", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/stores",
    payload: { type: "totalwines" },
    headers: await Fixtures.AuthenticatedHeaders({ admin: true }),
  });

  expect(response).toRespondWith(400);
});

test("type is required", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/stores",
    payload: { name: "Foo" },
    headers: await Fixtures.AuthenticatedHeaders({ admin: true }),
  });

  expect(response).toRespondWith(400);
});

test("creates a new store", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/stores",
    payload: {
      name: "Total Wines",
      type: "totalwines",
    },
    headers: await Fixtures.AuthenticatedHeaders({ admin: true }),
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [store] = await db.select().from(stores).where(eq(stores.id, data.id));
  expect(store.name).toEqual("Total Wines");
  expect(store.type).toEqual("totalwines");
  expect(store.lastRunAt).toBeNull();
  expect(store.country).toBeNull();
});
