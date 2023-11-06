import { db } from "@peated/core/db";
import { flights } from "@peated/core/db/schema";
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
    url: "/flights",
    payload: {},
    headers: await Fixtures.AuthenticatedHeaders(),
  });

  expect(response).toRespondWith(400);
});

test("creates a new flight", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/flights",
    payload: {
      name: "Macallan",
    },
    headers: await Fixtures.AuthenticatedHeaders(),
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [flight] = await db
    .select()
    .from(flights)
    .where(eq(flights.publicId, data.id));
  expect(flight.name).toEqual("Macallan");
});
