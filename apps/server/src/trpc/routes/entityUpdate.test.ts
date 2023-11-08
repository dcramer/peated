import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { omit } from "@peated/server/lib/filter";
import { eq } from "drizzle-orm";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("requires authentication", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() =>
    caller.entityUpdate({
      entity: 1,
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("requires mod", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  expect(() =>
    caller.entityUpdate({
      entity: 1,
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("no changes", async () => {
  const entity = await Fixtures.Entity();
  const response = await app.inject({
    method: "PUT",
    url: `/entities/${entity.id}`,
    payload: {},
    headers: await Fixtures.AuthenticatedHeaders({
      mod: true,
    }),
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(entity).toEqual(newEntity);
});

test("can change name", async () => {
  const entity = await Fixtures.Entity();
  const response = await app.inject({
    method: "PUT",
    url: `/entities/${entity.id}`,
    payload: {
      name: "Delicious Wood",
    },
    headers: await Fixtures.AuthenticatedHeaders({
      mod: true,
    }),
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(omit(entity, "name")).toEqual(omit(newEntity, "name"));
  expect(newEntity.name).toBe("Delicious Wood");
});

test("can change country", async () => {
  const entity = await Fixtures.Entity();
  const response = await app.inject({
    method: "PUT",
    url: `/entities/${entity.id}`,
    payload: {
      country: "Scotland",
    },
    headers: await Fixtures.AuthenticatedHeaders({
      mod: true,
    }),
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(omit(entity, "country")).toEqual(omit(newEntity, "country"));
  expect(newEntity.country).toBe("Scotland");
});

test("can change region", async () => {
  const entity = await Fixtures.Entity();
  const response = await app.inject({
    method: "PUT",
    url: `/entities/${entity.id}`,
    payload: {
      region: "Islay",
    },
    headers: await Fixtures.AuthenticatedHeaders({
      mod: true,
    }),
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(omit(entity, "region")).toEqual(omit(newEntity, "region"));
  expect(newEntity.region).toBe("Islay");
});

test("can change type", async () => {
  const entity = await Fixtures.Entity();
  const response = await app.inject({
    method: "PUT",
    url: `/entities/${entity.id}`,
    payload: {
      type: ["distiller"],
    },
    headers: await Fixtures.AuthenticatedHeaders({
      mod: true,
    }),
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(omit(entity, "type")).toEqual(omit(newEntity, "type"));
  expect(newEntity.type).toEqual(["distiller"]);
});
