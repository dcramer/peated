import buildFastify from "../app";
import { prisma } from "../lib/db";
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

test("lists bottles", async () => {
  await Fixtures.Bottle({ name: "Delicious Wood" });
  await Fixtures.Bottle({ name: "Something Else" });

  const response = await app.inject({
    method: "GET",
    url: "/bottles",
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.length).toBe(2);
});

test("lists bottles hides private", async () => {
  const bottle = await Fixtures.Bottle();
  const bottle2 = await Fixtures.Bottle({ public: false });

  let response = await app.inject({
    method: "GET",
    url: "/bottles",
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.length).toBe(1);
  expect(data[0].id).toBe(bottle.id);
});

test("lists bottles with query", async () => {
  const bottle1 = await Fixtures.Bottle({ name: "Delicious Wood" });
  await Fixtures.Bottle({ name: "Something Else" });

  let response = await app.inject({
    method: "GET",
    url: "/bottles",
    query: {
      query: "wood",
    },
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.length).toBe(1);
  expect(data[0].id).toBe(bottle1.id);
});

test("lists bottles with distiller", async () => {
  const distiller1 = await Fixtures.Distiller();
  const bottle1 = await Fixtures.Bottle({
    name: "Delicious Wood",
    distillerIds: [distiller1.id],
  });
  await Fixtures.Bottle({ name: "Something Else" });

  let response = await app.inject({
    method: "GET",
    url: "/bottles",
    query: {
      distiller: `${distiller1.id}`,
    },
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.length).toBe(1);
  expect(data[0].id).toBe(bottle1.id);
});

test("lists bottles with brand", async () => {
  const brand1 = await Fixtures.Brand();
  const bottle1 = await Fixtures.Bottle({
    name: "Delicious Wood",
    brandId: brand1.id,
  });
  await Fixtures.Bottle({ name: "Something Else" });

  let response = await app.inject({
    method: "GET",
    url: "/bottles",
    query: {
      brand: `${brand1.id}`,
    },
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.length).toBe(1);
  expect(data[0].id).toBe(bottle1.id);
});

test("get bottle", async () => {
  const bottle1 = await Fixtures.Bottle({ name: "Delicious Wood" });
  await Fixtures.Bottle({ name: "Something Else" });

  let response = await app.inject({
    method: "GET",
    url: `/bottles/${bottle1.id}`,
  });

  expect(response).toRespondWith(200);
  let data = JSON.parse(response.payload);
  expect(data.id).toBe(bottle1.id);
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
  const brand = await Fixtures.Brand();
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

  const bottle = await prisma.bottle.findUniqueOrThrow({
    where: { id: data.id },
    include: {
      distillers: true,
    },
  });
  expect(bottle.name).toEqual("Delicious Wood");
  expect(bottle.brandId).toBeDefined();
  expect(bottle.distillers.length).toBe(0);
  expect(bottle.abv).toBeNull();
  expect(bottle.statedAge).toBeNull();
  expect(bottle.series).toBeNull();
});

test("creates a new bottle with all params", async () => {
  const brand = await Fixtures.Brand();
  const distiller = await Fixtures.Distiller();
  const response = await app.inject({
    method: "POST",
    url: "/bottles",
    payload: {
      name: "Delicious Wood",
      brand: brand.id,
      distillers: [distiller.id],
      series: "Super Delicious",
      abv: 0.45,
      statedAge: 12,
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(201);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const bottle = await prisma.bottle.findUniqueOrThrow({
    where: { id: data.id },
    include: {
      distillers: true,
    },
  });
  expect(bottle.name).toEqual("Delicious Wood");
  expect(bottle.brandId).toEqual(brand.id);
  expect(bottle.distillers.length).toBe(1);
  expect(bottle.distillers[0].id).toEqual(distiller.id);
  expect(bottle.abv).toEqual(0.45);
  expect(bottle.statedAge).toEqual(12);
  expect(bottle.series).toEqual("Super Delicious");
  expect(bottle.createdById).toBe(DefaultFixtures.user.id);

  const changes = await prisma.change.findMany({
    where: {
      userId: DefaultFixtures.user.id,
    },
  });
  expect(changes.length).toBe(1);
  expect(changes[0].objectId).toBe(bottle.id);
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
//   const brand = await Fixtures.Brand();
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

  const bottle = await prisma.bottle.findUniqueOrThrow({
    where: { id: data.id },
    include: {
      brand: true,
    },
  });
  expect(bottle.name).toEqual("Delicious Wood");
  expect(bottle.brandId).toBeDefined();
  expect(bottle.brand.name).toBe("Hard Knox");
  expect(bottle.brand.country).toBe("Scotland");
  expect(bottle.brand.createdById).toBe(DefaultFixtures.user.id);

  // it should create a change entry for the brand
  const changes = await prisma.change.findMany({
    where: {
      userId: DefaultFixtures.user.id,
      objectType: "brand",
    },
  });
  expect(changes.length).toBe(1);
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
//   const brand = await Fixtures.Brand();
//   const distiller = await Fixtures.Distiller();
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

  const bottle = await prisma.bottle.findUniqueOrThrow({
    where: { id: data.id },
    include: {
      distillers: true,
    },
  });
  expect(bottle.name).toEqual("Delicious Wood");
  expect(bottle.distillers.length).toEqual(1);
  expect(bottle.distillers[0].id).toBeDefined();
  expect(bottle.distillers[0].name).toBe("Hard Knox");
  expect(bottle.distillers[0].country).toBe("Scotland");
  expect(bottle.distillers[0].createdById).toBe(DefaultFixtures.user.id);

  // it should create a change entry for the brand
  const changes = await prisma.change.findMany({
    where: {
      userId: DefaultFixtures.user.id,
      objectType: "distiller",
    },
  });
  expect(changes.length).toBe(1);
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

  const bottle2 = await prisma.bottle.findUniqueOrThrow({
    where: { id: data.id },
  });

  expect(omit(bottle, "name")).toEqual(omit(bottle2, "name"));
  expect(bottle2.name).toBe("Delicious Wood");
});
