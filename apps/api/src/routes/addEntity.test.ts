import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import buildFastify from "../app";
import { db } from "../db";
import { entities } from "../db/schema";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    await app.close();
  };
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
