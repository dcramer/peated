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

  expect(omit(entity, "name", "searchVector", "updatedAt")).toEqual(
    omit(newEntity, "name", "searchVector", "updatedAt"),
  );
  expect(newEntity.name).toBe("Delicious Wood");

  const [change] = await db
    .select()
    .from(changes)
    .where(eq(changes.objectId, newEntity.id))
    .orderBy(desc(changes.id))
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
    country: country.id,
  });

  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(omit(entity, "countryId", "searchVector", "updatedAt")).toEqual(
    omit(newEntity, "countryId", "searchVector", "updatedAt"),
  );
  expect(newEntity.countryId).toBe(country.id);
});

test("can remove country", async ({ fixtures }) => {
  const region = await fixtures.Region();
  const entity = await fixtures.Entity({
    regionId: region.id,
    countryId: region.countryId,
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  const data = await caller.entityUpdate({
    entity: entity.id,
    country: null,
  });

  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(newEntity.countryId).toBeNull();
  expect(newEntity.regionId).toBeNull();
});

test("can change region", async ({ fixtures }) => {
  const entity = await fixtures.Entity();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const region = await fixtures.Region();

  const data = await caller.entityUpdate({
    entity: entity.id,
    country: region.countryId,
    region: region.id,
  });

  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(
    omit(entity, "countryId", "regionId", "searchVector", "updatedAt"),
  ).toEqual(
    omit(newEntity, "countryId", "regionId", "searchVector", "updatedAt"),
  );
  expect(newEntity.regionId).toBe(region.id);
});

test("can remove region", async ({ fixtures }) => {
  const region = await fixtures.Region();
  const entity = await fixtures.Entity({
    regionId: region.id,
    countryId: region.countryId,
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  const data = await caller.entityUpdate({
    entity: entity.id,
    country: region.countryId,
    region: null,
  });

  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(newEntity.regionId).toBeNull();
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

  expect(omit(entity, "type", "searchVector", "updatedAt")).toEqual(
    omit(newEntity, "type", "searchVector", "updatedAt"),
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

  expect(omit(entity, "name", "searchVector", "updatedAt")).toEqual(
    omit(newEntity, "name", "searchVector", "updatedAt"),
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

  expect(omit(entity, "shortName", "searchVector", "updatedAt")).toEqual(
    omit(newEntity, "shortName", "searchVector", "updatedAt"),
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

  expect(
    omit(entity, "description", "descriptionSrc", "searchVector", "updatedAt"),
  ).toEqual(
    omit(
      newEntity,
      "description",
      "descriptionSrc",
      "searchVector",
      "updatedAt",
    ),
  );
  expect(newEntity.description).toBe("Delicious Wood");
  expect(newEntity.descriptionSrc).toEqual("user");

  const [change] = await db
    .select()
    .from(changes)
    .where(eq(changes.objectId, newEntity.id))
    .orderBy(desc(changes.id))
    .limit(1);

  expect(change.data).toEqual({
    description: "Delicious Wood",
    descriptionSrc: "user",
  });
});

test("updates existing conflicting alias", async ({ fixtures }) => {
  const entity = await fixtures.Entity();
  const existingAlias = await fixtures.BottleAlias({
    bottleId: null,
    name: "Cool Cats Single Barrel Bourbon",
  });
  const existingBottle = await fixtures.Bottle({
    brandId: entity.id,
    name: "Single Barrel Bourbon",
  });

  expect(existingAlias.bottleId).toBeNull();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.entityUpdate({
    entity: entity.id,
    name: "Cool Cats",
  });

  expect(data.id).toBeDefined();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(newEntity.name).toEqual("Cool Cats");

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, existingBottle.id));
  expect(newBottle.fullName).toEqual("Cool Cats Single Barrel Bourbon");

  const [newAlias] = await db
    .select()
    .from(bottleAliases)
    .where(eq(bottleAliases.name, existingAlias.name));
  expect(newAlias.name).toEqual("Cool Cats Single Barrel Bourbon");
  expect(newAlias.bottleId).toEqual(newBottle.id);
});

test("can change parent", async ({ fixtures }) => {
  const entity = await fixtures.Entity();
  const parentEntity = await fixtures.Entity();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  const data = await caller.entityUpdate({
    entity: entity.id,
    parent: parentEntity.id,
  });

  expect(data.id).toBeDefined();
  expect(data.parent).toBeDefined();
  expect(data.parent?.id).toEqual(parentEntity.id);
  expect(data.parent?.name).toEqual(parentEntity.name);

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(omit(entity, "parentId", "searchVector", "updatedAt")).toEqual(
    omit(newEntity, "parentId", "searchVector", "updatedAt"),
  );
  expect(newEntity.parentId).toBe(parentEntity.id);

  // Verify that the change is recorded in the changes table
  const [change] = await db
    .select()
    .from(changes)
    .where(eq(changes.objectId, newEntity.id))
    .orderBy(desc(changes.id))
    .limit(1);

  expect(change).toBeDefined();
  expect(change.data).toHaveProperty("parentId", parentEntity.id);
});

test("can remove parent", async ({ fixtures }) => {
  const parentEntity = await fixtures.Entity();
  const entity = await fixtures.Entity({
    parentId: parentEntity.id,
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  const data = await caller.entityUpdate({
    entity: entity.id,
    parent: null,
  });

  expect(data.id).toBeDefined();
  expect(data.parent).toBeNull();

  const [newEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(newEntity.parentId).toBeNull();
});

test("prevents circular parent references", async ({ fixtures }) => {
  const entity = await fixtures.Entity();
  const childEntity = await fixtures.Entity({
    parentId: entity.id,
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  const err = await waitError(
    caller.entityUpdate({
      entity: entity.id,
      parent: childEntity.id,
    }),
  );

  expect(err).toMatchInlineSnapshot(`[TRPCError: BAD_REQUEST]`);
  expect(err.message).toContain("circular reference");
});

test("prevents deep circular parent references", async ({ fixtures }) => {
  const rootEntity = await fixtures.Entity();
  const midEntity = await fixtures.Entity({
    parentId: rootEntity.id,
  });
  const leafEntity = await fixtures.Entity({
    parentId: midEntity.id,
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  const err = await waitError(
    caller.entityUpdate({
      entity: rootEntity.id,
      parent: leafEntity.id,
    }),
  );

  expect(err).toMatchInlineSnapshot(`[TRPCError: BAD_REQUEST]`);
  expect(err.message).toContain("circular reference");
});

test("fails with invalid parent entity ID", async ({ fixtures }) => {
  const entity = await fixtures.Entity();
  const nonExistentParentId = 999999; // A parent ID that doesn't exist

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  const err = await waitError(
    caller.entityUpdate({
      entity: entity.id,
      parent: nonExistentParentId,
    }),
  );

  expect(err).toMatchInlineSnapshot(`[TRPCError: NOT_FOUND]`);
  expect(err.message).toContain("Parent entity not found");
});
