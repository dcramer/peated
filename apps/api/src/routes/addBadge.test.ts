import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { badges } from "~/db/schema";
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
    url: "/badges",
    payload: {
      type: "category",
      name: "Single Malts",
      config: { category: "single_malt" },
    },
    headers: await Fixtures.AuthenticatedHeaders({ mod: true }),
  });

  expect(response).toRespondWith(403);
});

test("name is required", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/badges",
    payload: {
      type: "category",
      config: { category: "single_malt" },
    },
    headers: await Fixtures.AuthenticatedHeaders({ admin: true }),
  });

  expect(response).toRespondWith(400);
});

test("type is required", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/badges",
    payload: {
      name: "Single Malts",
      config: { category: "single_malt" },
    },
    headers: await Fixtures.AuthenticatedHeaders({ admin: true }),
  });

  expect(response).toRespondWith(400);
});

test("validates config for category", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/badges",
    payload: {
      type: "category",
      name: "Single Malts",
      config: { bottle: 1 },
    },
    headers: await Fixtures.AuthenticatedHeaders({ admin: true }),
  });
  expect(response).toRespondWith(400);
});

test("creates badge", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/badges",
    payload: {
      type: "category",
      name: "Single Malts",
      config: { category: "single_malt" },
    },
    headers: await Fixtures.AuthenticatedHeaders({ admin: true }),
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [badge] = await db.select().from(badges).where(eq(badges.id, data.id));
  expect(badge.name).toEqual("Single Malts");
  expect(badge.type).toEqual("category");
  expect(badge.config).toEqual({ category: "single_malt" });
});
