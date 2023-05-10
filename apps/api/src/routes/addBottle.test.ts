import { and, eq } from "drizzle-orm";
import buildFastify from "../app";
import { bottles, bottlesToDistillers, changes, entities } from "../db/schema";
import { db } from "../lib/db";
import * as Fixtures from "../lib/test/fixtures";
import { FastifyInstance } from "fastify";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    await app.close();
  };
});

test("requires authentication", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      brand: 1,
    },
  });

  expect(response).toRespondWith(401);
});

test("creates a new bottle with minimal params", async () => {
  const brand = await Fixtures.Entity();
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      brand: brand.id,
    },
    headers: await Fixtures.AuthenticatedHeaders(),
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [bottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));
  expect(bottle.name).toEqual("Delicious Wood");
  expect(bottle.brandId).toBeDefined();
  expect(bottle.statedAge).toBeNull();
  const distillers = await db
    .select()
    .from(bottlesToDistillers)
    .where(eq(bottlesToDistillers.bottleId, bottle.id));
  expect(distillers.length).toBe(0);
});

test("creates a new bottle with all params", async () => {
  const brand = await Fixtures.Entity();
  const distiller = await Fixtures.Entity();
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      brand: brand.id,
      distillers: [distiller.id],
      statedAge: 12,
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [bottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));
  expect(bottle.name).toEqual("Delicious Wood");
  expect(bottle.brandId).toEqual(brand.id);
  expect(bottle.statedAge).toEqual(12);
  expect(bottle.createdById).toBe(DefaultFixtures.user.id);
  const distillers = await db
    .select({ distillerId: bottlesToDistillers.distillerId })
    .from(bottlesToDistillers)
    .where(eq(bottlesToDistillers.bottleId, bottle.id));
  expect(distillers.length).toBe(1);
  expect(distillers[0].distillerId).toEqual(distiller.id);

  const changeList = await db
    .select({ change: changes })
    .from(changes)
    .where(eq(changes.createdById, DefaultFixtures.user.id));

  expect(changeList.length).toBe(1);
  expect(changeList[0].change.objectId).toBe(bottle.id);
});

test("creates a new bottle with invalid brandId", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      brand: 5,
    },
    headers: await Fixtures.AuthenticatedHeaders(),
  });

  expect(response).toRespondWith(400);
});

// test("creates a new bottle with existing brand name", async () => {
//   const brand = await Fixtures.Entity();
//   const response = await app.inject({
//     method: "POST",
//     url: "/bottles",
//     payload: {
//       name: "Delicious Wood",
//       brand: {
//         name: brand.name,
//         country: brand.country,
//       },
//     },
//     headers: DefaultFixtures.authHeaders,
//   });

//   expect(response).toRespondWith(201);
//   const data = JSON.parse(response.payload);
//   expect(data.id).toBeDefined();

//   const bottle = await prisma.bottle.findUniqueOrThrow({
//     where: { id: data.id },
//   });
//   expect(bottle.name).toEqual("Delicious Wood");
//   expect(bottle.brandId).toEqual(brand.id);

//   // it should not create a change entry for the brand
//   const changes = await prisma.change.findMany({
//     where: {
//       userId: DefaultFixtures.user.id,
//       objectType: "brand",
//     },
//   });
//   expect(changes.length).toBe(0);
// });

test("creates a new bottle with new brand name", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      brand: {
        name: "Hard Knox",
        country: "Scotland",
      },
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [{ bottle, brand }] = await db
    .select({ bottle: bottles, brand: entities })
    .from(bottles)
    .innerJoin(entities, eq(entities.id, bottles.brandId))
    .where(eq(bottles.id, data.id));

  expect(bottle.name).toEqual("Delicious Wood");
  expect(bottle.brandId).toBeDefined();
  expect(brand.name).toBe("Hard Knox");
  expect(brand.country).toBe("Scotland");
  expect(brand.createdById).toBe(DefaultFixtures.user.id);

  // it should create a change entry for the brand

  const changeList = await db
    .select({ change: changes })
    .from(changes)
    .where(
      and(
        eq(changes.objectType, "entity"),
        eq(changes.createdById, DefaultFixtures.user.id)
      )
    );

  expect(changeList.length).toBe(1);
});

test("creates a new bottle with invalid distillerId", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      brand: {
        name: "Hard Knox",
        country: "Scotland",
      },
      distillers: [5],
    },
    headers: await Fixtures.AuthenticatedHeaders(),
  });

  expect(response).toRespondWith(400);
});

// test("creates a new bottle with existing distiller name", async () => {
//   const brand = await Fixtures.Entity();
//   const distiller = await Fixtures.Entity();
//   const response = await app.inject({
//     method: "POST",
//     url: "/bottles",
//     payload: {
//       name: "Delicious Wood",
//       brand: {
//         name: brand.name,
//         country: brand.country,
//       },
//       distillers: [
//         {
//           name: distiller.name,
//           country: distiller.country,
//         },
//       ],
//     },
//     headers: DefaultFixtures.authHeaders,
//   });

//   expect(response).toRespondWith(201);
//   const data = JSON.parse(response.payload);
//   expect(data.id).toBeDefined();

//   const bottle = await prisma.bottle.findUniqueOrThrow({
//     where: { id: data.id },
//     include: {
//       distillers: true,
//     },
//   });
//   expect(bottle.name).toEqual("Delicious Wood");
//   expect(bottle.distillers.length).toEqual(1);
//   expect(bottle.distillers[0].id).toEqual(distiller.id);

//   // it should not create a change entry for the brand
//   const changes = await prisma.change.findMany({
//     where: {
//       userId: DefaultFixtures.user.id,
//       objectType: "distiller",
//     },
//   });
//   expect(changes.length).toBe(0);
// });

test("creates a new bottle with new distiller name", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      brand: {
        name: "Hard Knox",
        country: "Scotland",
      },
      distillers: [
        {
          name: "Hard Knox",
          country: "Scotland",
        },
      ],
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [bottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));
  expect(bottle.name).toEqual("Delicious Wood");

  const distillers = await db
    .select({ distiller: entities })
    .from(entities)
    .innerJoin(
      bottlesToDistillers,
      eq(bottlesToDistillers.entityId, entities.id)
    )
    .where(eq(bottlesToDistillers.bottleId, bottle.id));

  expect(distillers.length).toEqual(1);
  const { distiller } = distillers[0];
  expect(distiller.id).toBeDefined();
  expect(distiller.name).toBe("Hard Knox");
  expect(distiller.country).toBe("Scotland");
  expect(distiller.createdById).toBe(DefaultFixtures.user.id);

  // it should create a change entry for the brand
  const changeList = await db
    .select({ change: changes })
    .from(changes)
    .where(
      and(
        eq(changes.objectType, "entity"),
        eq(changes.createdById, DefaultFixtures.user.id)
      )
    );
  expect(changeList.length).toBe(1);
});
