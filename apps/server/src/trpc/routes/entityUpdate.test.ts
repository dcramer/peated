import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  changes,
  entities,
} from "@peated/server/db/schema";
import { omit } from "@peated/server/lib/filter";
import { desc, eq } from "drizzle-orm";
import * as Fixtures from "../../lib/test/fixtures";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  expect(() =>
    caller.entityUpdate({
      entity: 1,
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("requires mod", async () => {
  const caller = createCaller({ user: DefaultFixtures.user });
  expect(() =>
    caller.entityUpdate({
      entity: 1,
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("no changes", async () => {
  const entity = await Fixtures.Entity();

  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  const data = await caller.entityUpdate({
    entity: entity.id,
  });

  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(entity).toEqual(newEntity);
});

test("can change name", async () => {
  const entity = await Fixtures.Entity();

  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  const data = await caller.entityUpdate({
    entity: entity.id,
    name: "Delicious Wood",
  });

  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(omit(entity, "name")).toEqual(omit(newEntity, "name"));
  expect(newEntity.name).toBe("Delicious Wood");

  const [change] = await db
    .select()
    .from(changes)
    .where(eq(changes.objectId, newEntity.id))
    .orderBy(desc(changes.createdAt))
    .limit(1);

  expect(change.data).toEqual({ name: "Delicious Wood" });
});

test("can change country", async () => {
  const entity = await Fixtures.Entity();

  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  const data = await caller.entityUpdate({
    entity: entity.id,
    country: "Scotland",
  });

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

  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  const data = await caller.entityUpdate({
    entity: entity.id,
    region: "Islay",
  });

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

  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  const data = await caller.entityUpdate({
    entity: entity.id,
    type: ["distiller"],
  });

  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(omit(entity, "type")).toEqual(omit(newEntity, "type"));
  expect(newEntity.type).toEqual(["distiller"]);
});

test("name change updates bottles if brand", async () => {
  const entity = await Fixtures.Entity({
    name: "Foo",
    type: ["brand", "distiller"],
  });
  const bottle = await Fixtures.Bottle({
    brandId: entity.id,
    name: "Bar",
  });
  expect(bottle.fullName).toEqual("Foo Bar");

  const otherBottle = await Fixtures.Bottle({
    distillerIds: [entity.id],
  });

  const caller = createCaller({
    user: await Fixtures.User({ mod: true }),
  });
  const data = await caller.entityUpdate({
    entity: entity.id,
    name: "Bar",
  });

  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(omit(entity, "name")).toEqual(omit(newEntity, "name"));
  expect(newEntity.name).toBe("Bar");

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));

  expect(newBottle.name).toEqual(bottle.name);
  expect(newBottle.fullName).toEqual("Bar Bar");

  const [newAlias] = await db
    .select()
    .from(bottleAliases)
    .where(eq(bottleAliases.bottleId, bottle.id));
  expect(newAlias.name).toEqual(newBottle.fullName);

  const [newOtherBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, otherBottle.id));

  expect(newOtherBottle.fullName).toEqual(otherBottle.fullName);
});
