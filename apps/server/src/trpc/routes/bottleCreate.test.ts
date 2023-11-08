import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  changes,
  entities,
} from "@peated/server/db/schema";
import { and, eq } from "drizzle-orm";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("requires authentication", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() =>
    caller.bottleCreate({
      name: "Delicious Wood",
      brand: 1,
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("creates a new bottle with minimal params", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const brand = await Fixtures.Entity();
  const data = await caller.bottleCreate({
    name: "Delicious Wood",
    brand: brand.id,
  });

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
  const [newBrand] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, brand.id));
  expect(newBrand.totalBottles).toBe(1);
});

test("creates a new bottle with all params", async () => {
  const brand = await Fixtures.Entity();
  const distiller = await Fixtures.Entity();

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.bottleCreate({
    name: "Delicious Wood 12-year-old",
    brand: brand.id,
    bottler: distiller.id,
    distillers: [distiller.id],
    statedAge: 12,
  });

  expect(data.id).toBeDefined();

  const [bottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));
  expect(bottle.name).toEqual("Delicious Wood 12-year-old");
  expect(bottle.brandId).toEqual(brand.id);
  expect(bottle.statedAge).toEqual(12);
  expect(bottle.createdById).toBe(DefaultFixtures.user.id);
  const distillers = await db
    .select({ distillerId: bottlesToDistillers.distillerId })
    .from(bottlesToDistillers)
    .where(eq(bottlesToDistillers.bottleId, bottle.id));
  expect(distillers.length).toBe(1);
  expect(distillers[0].distillerId).toEqual(distiller.id);

  const newDistiller = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, distiller.id),
  });
  expect(newDistiller?.totalBottles).toBe(1);

  const newBrand = await db.query.entities.findFirst({
    where: (entities, { eq }) => eq(entities.id, brand.id),
  });
  expect(newBrand?.totalBottles).toBe(1);

  const changeList = await db
    .select({ change: changes })
    .from(changes)
    .where(eq(changes.createdById, DefaultFixtures.user.id));

  expect(changeList.length).toBe(1);
  expect(changeList[0].change.objectId).toBe(bottle.id);
});

test("does not create a new bottle with invalid brandId", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  expect(() =>
    caller.bottleCreate({
      name: "Delicious Wood",
      brand: 5,
    }),
  ).rejects.toThrowError(/Could not identify brand/);
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
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.bottleCreate({
    name: "Delicious Wood",
    brand: {
      name: "Hard Knox",
      country: "Scotland",
    },
  });

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
  expect(brand.totalBottles).toBe(1);
  // it should create a change entry for the brand

  const changeList = await db
    .select({ change: changes })
    .from(changes)
    .where(
      and(
        eq(changes.objectType, "entity"),
        eq(changes.createdById, DefaultFixtures.user.id),
      ),
    );

  expect(changeList.length).toBe(1);

  const [newBrand] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, brand.id));
});

test("does not create a new bottle with invalid distillerId", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  expect(() =>
    caller.bottleCreate({
      name: "Delicious Wood",
      brand: {
        name: "Hard Knox",
        country: "Scotland",
      },
      distillers: [500000],
    }),
  ).rejects.toThrowError(/Could not identify distiller/);
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
  const brand = await Fixtures.Entity();

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.bottleCreate({
    name: "Delicious Wood",
    brand: brand.id,
    distillers: [
      {
        name: "Hard Knox",
        country: "Scotland",
      },
    ],
  });

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
      eq(bottlesToDistillers.distillerId, entities.id),
    )
    .where(eq(bottlesToDistillers.bottleId, bottle.id));

  expect(distillers.length).toEqual(1);
  const { distiller } = distillers[0];
  expect(distiller.id).toBeDefined();
  expect(distiller.name).toBe("Hard Knox");
  expect(distiller.country).toBe("Scotland");
  expect(distiller.createdById).toBe(DefaultFixtures.user.id);
  expect(distiller.totalBottles).toBe(1);

  const [newBrand] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, brand.id));
  expect(newBrand.totalBottles).toBe(1);

  // it should create a change entry for the distiller
  const changeList = await db
    .select({ change: changes })
    .from(changes)
    .where(
      and(
        eq(changes.objectType, "entity"),
        eq(changes.createdById, DefaultFixtures.user.id),
      ),
    );
  expect(changeList.length).toBe(1);
});

test("creates a new bottle with new distiller name and brand name", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.bottleCreate({
    name: "Delicious Wood",
    brand: {
      name: "Rip Van",
      region: "Kentucky",
    },
    distillers: [
      {
        name: "Hard Knox",
        country: "Scotland",
      },
    ],
  });

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
      eq(bottlesToDistillers.distillerId, entities.id),
    )
    .where(eq(bottlesToDistillers.bottleId, bottle.id));

  expect(distillers.length).toEqual(1);
  const { distiller } = distillers[0];
  expect(distiller.id).toBeDefined();
  expect(distiller.name).toBe("Hard Knox");
  expect(distiller.country).toBe("Scotland");
  expect(distiller.createdById).toBe(DefaultFixtures.user.id);
  expect(distiller.totalBottles).toBe(1);

  const [brand] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, bottle.brandId));
  expect(brand.name).toBe("Rip Van");
  expect(brand.region).toBe("Kentucky");
  expect(brand.totalBottles).toBe(1);

  // it should create a change entry for the brand and distiller
  const changeList = await db
    .select({ change: changes })
    .from(changes)
    .where(
      and(
        eq(changes.objectType, "entity"),
        eq(changes.createdById, DefaultFixtures.user.id),
      ),
    );
  expect(changeList.length).toBe(2);
});

test("creates a new bottle with new distiller name which is duplicated as brand name", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.bottleCreate({
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
  });

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
      eq(bottlesToDistillers.distillerId, entities.id),
    )
    .where(eq(bottlesToDistillers.bottleId, bottle.id));

  expect(distillers.length).toEqual(1);
  const { distiller } = distillers[0];
  expect(distiller.id).toEqual(bottle.brandId);
  expect(distiller.name).toBe("Hard Knox");
  expect(distiller.country).toBe("Scotland");
  expect(distiller.createdById).toBe(DefaultFixtures.user.id);
  expect(distiller.totalBottles).toBe(1);
  expect(distiller.id).toBe(bottle.brandId);

  // it should create a change entry for the brand and distiller
  const changeList = await db
    .select({ change: changes })
    .from(changes)
    .where(
      and(
        eq(changes.objectType, "entity"),
        eq(changes.createdById, DefaultFixtures.user.id),
      ),
    );
  expect(changeList.length).toBe(1);
});

test("refuses bottle w/ age signal", async () => {
  const brand = await Fixtures.Entity();
  const distiller = await Fixtures.Entity();

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });

  expect(() =>
    caller.bottleCreate({
      name: "Delicious Wood 12-year-old",
      brand: brand.id,
      distillers: [distiller.id],
    }),
  ).rejects.toThrowError(/You should include the Stated Age of the bottle/);
});

test("removes duplicated brand name", async () => {
  const brand = await Fixtures.Entity({ name: "Delicious Wood" });
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.bottleCreate({
    name: "Delicious Wood Yum Yum",
    brand: brand.id,
  });

  expect(data.id).toBeDefined();

  const [bottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));
  expect(bottle.name).toEqual("Yum Yum");
});
