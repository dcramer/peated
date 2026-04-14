import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  changes,
  entities,
  entityAliases,
} from "@peated/server/db/schema";
import { omit } from "@peated/server/lib/filter";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { desc, eq } from "drizzle-orm";

describe("PATCH /entities/:entity", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.entities.update(
        {
          entity: 1,
        },
        { context: { user: null } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod", async ({ defaults }) => {
    const err = await waitError(
      routerClient.entities.update(
        {
          entity: 1,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("no changes", async ({ fixtures }) => {
    const entity = await fixtures.Entity();
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.entities.update(
      {
        entity: entity.id,
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();

    const [newEntity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, data.id));

    expect(entity).toEqual(newEntity);
  });

  test("can change name", async ({ fixtures }) => {
    const entity = await fixtures.Entity();
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.entities.update(
      {
        entity: entity.id,
        name: "Delicious Wood",
      },
      { context: { user: modUser } },
    );

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
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.entities.update(
      {
        entity: entity.id,
        country: country.id,
      },
      { context: { user: modUser } },
    );

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
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.entities.update(
      {
        entity: entity.id,
        country: null,
      },
      { context: { user: modUser } },
    );

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
    const modUser = await fixtures.User({ mod: true });
    const region = await fixtures.Region();

    const data = await routerClient.entities.update(
      {
        entity: entity.id,
        country: region.countryId,
        region: region.id,
      },
      { context: { user: modUser } },
    );

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
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.entities.update(
      {
        entity: entity.id,
        country: region.countryId,
        region: null,
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();

    const [newEntity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, data.id));

    expect(newEntity.regionId).toBeNull();
  });

  test("can change type", async ({ fixtures }) => {
    const entity = await fixtures.Entity();
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.entities.update(
      {
        entity: entity.id,
        type: ["distiller"],
      },
      { context: { user: modUser } },
    );

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

    const modUser = await fixtures.User({ mod: true });
    const data = await routerClient.entities.update(
      {
        entity: entity.id,
        name: "Bar",
      },
      { context: { user: modUser } },
    );

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

    const modUser = await fixtures.User({ mod: true });
    const data = await routerClient.entities.update(
      {
        entity: entity.id,
        shortName: "F",
      },
      { context: { user: modUser } },
    );

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

    const shortNameAlias = await db.query.entityAliases.findFirst({
      where: eq(entityAliases.name, "F"),
    });
    expect(shortNameAlias?.entityId).toEqual(entity.id);
  });

  test("name change preserves brand bottle aliases when short name stays the same", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Foo Distillery",
      shortName: "FD",
      type: ["brand", "distiller"],
    });
    const bottle = await fixtures.Bottle({
      brandId: entity.id,
      name: "Bar",
    });
    expect(bottle.fullName).toEqual("FD Bar");

    const modUser = await fixtures.User({ mod: true });
    await routerClient.entities.update(
      {
        entity: entity.id,
        name: "Foo Co",
      },
      { context: { user: modUser } },
    );

    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle.fullName).toEqual("FD Bar");

    const preservedAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, "FD Bar"),
    });
    expect(preservedAlias?.bottleId).toEqual(bottle.id);

    const oldEntityAlias = await db.query.entityAliases.findFirst({
      where: eq(entityAliases.name, "Foo Distillery"),
    });
    expect(oldEntityAlias).toBeUndefined();

    const currentEntityAlias = await db.query.entityAliases.findFirst({
      where: eq(entityAliases.name, "Foo Co"),
    });
    expect(currentEntityAlias?.entityId).toEqual(entity.id);

    const preservedShortNameAlias = await db.query.entityAliases.findFirst({
      where: eq(entityAliases.name, "FD"),
    });
    expect(preservedShortNameAlias?.entityId).toEqual(entity.id);
  });

  test("changing short name retires the old entity alias", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Foo",
      shortName: "F",
      type: ["brand", "distiller"],
    });
    const bottle = await fixtures.Bottle({
      brandId: entity.id,
      name: "Bar",
    });
    expect(bottle.fullName).toEqual("F Bar");

    const modUser = await fixtures.User({ mod: true });
    await routerClient.entities.update(
      {
        entity: entity.id,
        shortName: "FC",
      },
      { context: { user: modUser } },
    );

    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle.fullName).toEqual("FC Bar");

    const oldBottleAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, "F Bar"),
    });
    expect(oldBottleAlias).toBeUndefined();

    const newBottleAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, "FC Bar"),
    });
    expect(newBottleAlias?.bottleId).toEqual(bottle.id);

    const oldEntityAlias = await db.query.entityAliases.findFirst({
      where: eq(entityAliases.name, "F"),
    });
    expect(oldEntityAlias).toBeUndefined();

    const newEntityAlias = await db.query.entityAliases.findFirst({
      where: eq(entityAliases.name, "FC"),
    });
    expect(newEntityAlias?.entityId).toEqual(entity.id);
  });

  test("clearing short name reverts brand bottle names and removes the old display alias", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Foo",
      shortName: "F",
      type: ["brand", "distiller"],
    });
    const bottle = await fixtures.Bottle({
      brandId: entity.id,
      name: "Bar",
    });
    expect(bottle.fullName).toEqual("F Bar");

    const modUser = await fixtures.User({ mod: true });
    await routerClient.entities.update(
      {
        entity: entity.id,
        shortName: null,
      },
      { context: { user: modUser } },
    );

    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle.fullName).toEqual("Foo Bar");

    const oldShortNameAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, "F Bar"),
    });
    expect(oldShortNameAlias).toBeUndefined();

    const oldEntityAlias = await db.query.entityAliases.findFirst({
      where: eq(entityAliases.name, "F"),
    });
    expect(oldEntityAlias).toBeUndefined();

    const revertedAlias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, "Foo Bar"),
    });
    expect(revertedAlias?.bottleId).toEqual(bottle.id);

    const canonicalEntityAlias = await db.query.entityAliases.findFirst({
      where: eq(entityAliases.name, "Foo"),
    });
    expect(canonicalEntityAlias?.entityId).toEqual(entity.id);
  });

  test("sets descriptionSrc with description", async ({ fixtures }) => {
    const entity = await fixtures.Entity();
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.entities.update(
      {
        entity: entity.id,
        description: "Delicious Wood",
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();

    const [newEntity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, data.id));

    expect(
      omit(
        entity,
        "description",
        "descriptionSrc",
        "searchVector",
        "updatedAt",
      ),
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
    const modUser = await fixtures.User({ mod: true });

    expect(existingAlias.bottleId).toBeNull();

    const data = await routerClient.entities.update(
      {
        entity: entity.id,
        name: "Cool Cats",
      },
      { context: { user: modUser } },
    );

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
});
