import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  changes,
  entities,
} from "@peated/server/db/schema";
import { omit } from "@peated/server/lib/filter";
import waitError from "@peated/server/lib/test/waitError";
import { desc, eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(
    caller.entityUpdate({
      entity: 1,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("requires mod", async ({ defaults }) => {
  const caller = createCaller({ user: defaults.user });
  const err = await waitError(
    caller.entityUpdate({
      entity: 1,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("no changes", async ({ fixtures }) => {
  const entity = await fixtures.Entity();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
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

test("can change name", async ({ fixtures }) => {
  const entity = await fixtures.Entity();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
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

  expect(omit(entity, "name", "searchVector")).toEqual(
    omit(newEntity, "name", "searchVector"),
  );
  expect(newEntity.name).toBe("Delicious Wood");

  const [change] = await db
    .select()
    .from(changes)
    .where(eq(changes.objectId, newEntity.id))
    .orderBy(desc(changes.createdAt))
    .limit(1);

  expect(change.data).toEqual({ name: "Delicious Wood" });
});

test("can change country", async ({ fixtures }) => {
  const entity = await fixtures.Entity();
  const country = await fixtures.Country();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.entityUpdate({
    entity: entity.id,
    country: country.name,
  });

  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(omit(entity, "countryId", "searchVector")).toEqual(
    omit(newEntity, "countryId", "searchVector"),
  );
  expect(newEntity.countryId).toBe(country.id);
});

test("can change region", async ({ fixtures }) => {
  const entity = await fixtures.Entity();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
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

  expect(omit(entity, "region", "searchVector")).toEqual(
    omit(newEntity, "region", "searchVector"),
  );
  expect(newEntity.region).toBe("Islay");
});

test("can change type", async ({ fixtures }) => {
  const entity = await fixtures.Entity();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
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

  expect(omit(entity, "type", "searchVector")).toEqual(
    omit(newEntity, "type", "searchVector"),
  );
  expect(newEntity.type).toEqual(["distiller"]);
});

test("name change updates bottles if brand", async ({ fixtures }) => {
  const entity = await fixtures.Entity({
    name: "Foo",
    type: ["brand", "distiller"],
  });
  const bottle = await fixtures.Bottle({
    brandId: entity.id,
    name: "Bar",
  });
  expect(bottle.fullName).toEqual("Foo Bar");

  const otherBottle = await fixtures.Bottle({
    distillerIds: [entity.id],
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
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

  expect(omit(entity, "name", "searchVector")).toEqual(
    omit(newEntity, "name", "searchVector"),
  );
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

test("short name change updates bottles if brand", async ({ fixtures }) => {
  const entity = await fixtures.Entity({
    name: "Foo",
    type: ["brand", "distiller"],
  });
  const bottle = await fixtures.Bottle({
    brandId: entity.id,
    name: "Bar",
  });
  expect(bottle.fullName).toEqual("Foo Bar");

  const otherBottle = await fixtures.Bottle({
    distillerIds: [entity.id],
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.entityUpdate({
    entity: entity.id,
    shortName: "F",
  });

  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(omit(entity, "shortName", "searchVector")).toEqual(
    omit(newEntity, "shortName", "searchVector"),
  );
  expect(newEntity.shortName).toBe("F");

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));

  expect(newBottle.name).toEqual(bottle.name);
  expect(newBottle.fullName).toEqual("F Bar");

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

test("sets descriptionSrc with description", async ({ fixtures }) => {
  const entity = await fixtures.Entity();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.entityUpdate({
    entity: entity.id,
    description: "Delicious Wood",
  });

  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(omit(entity, "description", "descriptionSrc", "searchVector")).toEqual(
    omit(newEntity, "description", "descriptionSrc", "searchVector"),
  );
  expect(newEntity.description).toBe("Delicious Wood");
  expect(newEntity.descriptionSrc).toEqual("user");

  const [change] = await db
    .select()
    .from(changes)
    .where(eq(changes.objectId, newEntity.id))
    .orderBy(desc(changes.createdAt))
    .limit(1);

  expect(change.data).toEqual({
    description: "Delicious Wood",
    descriptionSrc: "user",
  });
});
