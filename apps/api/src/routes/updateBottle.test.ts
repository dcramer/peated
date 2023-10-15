import { db } from "@peated/shared/db";
import { bottles, bottlesToDistillers } from "@peated/shared/db/schema";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import buildFastify from "../app";
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
  const brand = await Fixtures.Entity();
  const bottle = await Fixtures.Bottle({ brandId: brand.id });
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

  expect(omit(bottle, "name", "fullName")).toEqual(
    omit(bottle2, "name", "fullName"),
  );
  expect(bottle2.name).toBe("Delicious Wood");
  expect(bottle2.fullName).toBe(`${brand.name} ${bottle2.name}`);
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
  const brand = await Fixtures.Entity();
  const bottle = await Fixtures.Bottle({ brandId: brand.id });
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

  expect(omit(bottle, "name", "fullName", "statedAge")).toEqual(
    omit(bottle2, "name", "fullName", "statedAge"),
  );
  expect(bottle2.statedAge).toBe(10);
  expect(bottle2.name).toBe("Delicious 10-year-old");
  expect(bottle2.fullName).toBe(`${brand.name} ${bottle2.name}`);
});

test("changes brand", async () => {
  const newBrand = await Fixtures.Entity();
  const bottle = await Fixtures.Bottle();
  const response = await app.inject({
    method: "PUT",
    url: `/bottles/${bottle.id}`,
    payload: {
      brand: newBrand.id,
    },
    headers: await Fixtures.AuthenticatedHeaders({ mod: true }),
  });

  expect(response).toRespondWith(200);
  const [bottle2] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));

  expect(omit(bottle, "brandId", "fullName")).toEqual(
    omit(bottle2, "brandId", "fullName"),
  );
  expect(bottle2.brandId).toBe(newBrand.id);
  expect(bottle2.fullName).toBe(`${newBrand.name} ${bottle.name}`);

  const newBrandRef = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, newBrand.id),
  });
  expect(newBrandRef?.totalBottles).toBe(1);

  const oldBrand = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, bottle.brandId),
  });
  expect(oldBrand?.totalBottles).toBe(0);
});

test("removes distiller", async () => {
  const distillerA = await Fixtures.Entity();
  const distillerB = await Fixtures.Entity();
  const bottle = await Fixtures.Bottle({
    distillerIds: [distillerA.id, distillerB.id],
  });
  const response = await app.inject({
    method: "PUT",
    url: `/bottles/${bottle.id}`,
    payload: {
      distillers: [distillerA.id],
    },
    headers: await Fixtures.AuthenticatedHeaders({ mod: true }),
  });

  expect(response).toRespondWith(200);
  const results = await db
    .select({
      distillerId: bottlesToDistillers.distillerId,
    })
    .from(bottlesToDistillers)
    .where(eq(bottlesToDistillers.bottleId, bottle.id));

  expect(results.length).toEqual(1);
  expect(results[0].distillerId).toEqual(distillerA.id);
});
