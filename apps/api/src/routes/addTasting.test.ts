import { eq } from "drizzle-orm";
import buildFastify from "../app";
import { tastings } from "../db/schema";
import { db } from "../db";
import * as Fixtures from "../lib/test/fixtures";
import { FastifyInstance } from "fastify";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();
});

afterAll(async () => {
  await app.close();
});

test("creates a new tasting with minimal params", async () => {
  const bottle = await Fixtures.Bottle();
  const response = await app.inject({
    method: "POST",
    url: "/tastings",
    payload: {
      bottle: bottle.id,
      rating: 3.5,
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [tasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, data.id));

  expect(tasting.bottleId).toEqual(bottle.id);
  expect(tasting.createdById).toEqual(DefaultFixtures.user.id);
  expect(tasting.rating).toEqual(3.5);
  expect(tasting.comments).toBeNull();
});

test("creates a new tasting with tags", async () => {
  const bottle = await Fixtures.Bottle();
  const response = await app.inject({
    method: "POST",
    url: "/tastings",
    payload: {
      bottle: bottle.id,
      rating: 3.5,
      tags: ["cherry", "PEAT"],
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [tasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, data.id));

  expect(tasting.bottleId).toEqual(bottle.id);
  expect(tasting.createdById).toEqual(DefaultFixtures.user.id);
  expect(tasting.tags).toEqual(["cherry", "peat"]);
});
