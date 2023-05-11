import { eq } from "drizzle-orm";
import buildFastify from "../app";
import { bottles } from "../db/schema";
import { db } from "../db";
import { omit } from "../lib/filter";
import * as Fixtures from "../lib/test/fixtures";
import { FastifyInstance } from "fastify";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();
});

afterAll(async () => {
  await app.close();
});

test("edits a new bottle with new name param", async () => {
  const bottle = await Fixtures.Bottle();
  const response = await app.inject({
    method: "PUT",
    url: `/bottles/${bottle.id}`,
    payload: {
      name: "Delicious Wood",
    },
    headers: await Fixtures.AuthenticatedHeaders(),
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [bottle2] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));

  expect(omit(bottle, "name")).toEqual(omit(bottle2, "name"));
  expect(bottle2.name).toBe("Delicious Wood");
});
