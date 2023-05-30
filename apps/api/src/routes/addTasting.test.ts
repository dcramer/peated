import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import buildFastify from "../app";
import { db } from "../db";
import { bottles, entities, tastings } from "../db/schema";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    await app.close();
  };
});

test("creates a new tasting with minimal params", async () => {
  const entity = await Fixtures.Entity({ type: ["brand", "distiller"] });
  const bottle = await Fixtures.Bottle({
    brandId: entity.id,
    distillerIds: [entity.id],
  });
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
  expect(tasting.notes).toBeNull();

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));
  expect(newBottle.totalTastings).toBe(1);

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entity.id));
  expect(newEntity.totalTastings).toBe(1);
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

  const tags = await db.query.bottleTags.findMany({
    where: (bottleTags, { eq }) => eq(bottleTags.bottleId, tasting.bottleId),
    orderBy: (bottleTags, { asc }) => asc(bottleTags.tag),
  });
  expect(tags.length).toBe(2);
  expect(tags[0].tag).toBe("cherry");
  expect(tags[0].count).toBe(1);
  expect(tags[1].tag).toBe("peat");
  expect(tags[1].count).toBe(1);
});

test("creates a new tasting with notes", async () => {
  const bottle = await Fixtures.Bottle();
  const response = await app.inject({
    method: "POST",
    url: "/tastings",
    payload: {
      bottle: bottle.id,
      rating: 3.5,
      notes: "hello world",
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

  expect(tasting.notes).toEqual("hello world");
});

test("creates a new tasting with all vintage params", async () => {
  const bottle = await Fixtures.Bottle();
  const response = await app.inject({
    method: "POST",
    url: "/tastings",
    payload: {
      bottle: bottle.id,
      rating: 3.5,
      vintageYear: 2023,
      barrel: 69,
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
  expect(tasting.vintageYear).toEqual(2023);
  expect(tasting.barrel).toEqual(69);
});

test("creates a new tasting with empty rating", async () => {
  const bottle = await Fixtures.Bottle();
  const response = await app.inject({
    method: "POST",
    url: "/tastings",
    payload: {
      bottle: bottle.id,
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
  expect(tasting.rating).toBeNull();
});

test("creates a new tasting with zero rating", async () => {
  const bottle = await Fixtures.Bottle();
  const response = await app.inject({
    method: "POST",
    url: "/tastings",
    payload: {
      bottle: bottle.id,
      rating: 0,
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
  expect(tasting.rating).toBeNull();
});
