import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroups,
  bottles,
  changes,
  entities,
  entityAliases,
} from "@peated/server/db/schema";
import { omit } from "@peated/server/lib/filter";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, desc, eq, inArray } from "drizzle-orm";

function requireGroupId(groupId: number | null): number {
  if (groupId === null) throw new Error("Missing BottleGroup fixture");
  return groupId;
}

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

  test("can change kind and current owner", async ({ fixtures }) => {
    const owner = await fixtures.Entity({ kind: "company" });
    const entity = await fixtures.Entity();
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.entities.update(
      {
        entity: entity.id,
        kind: "distillery",
        ownerId: owner.id,
      },
      { context: { user: modUser } },
    );

    expect(data).toMatchObject({
      kind: "distillery",
      ownerId: owner.id,
    });
    expect(
      await db.query.entities.findFirst({ where: eq(entities.id, entity.id) }),
    ).toMatchObject({
      kind: "distillery",
      ownerId: owner.id,
    });

    const [change] = await db
      .select()
      .from(changes)
      .where(eq(changes.objectId, entity.id))
      .orderBy(desc(changes.id))
      .limit(1);
    expect(change.data).toEqual({
      kind: "distillery",
      ownerId: owner.id,
    });
  });

  test("allows a current owner chain", async ({ fixtures }) => {
    const company = await fixtures.Entity({ kind: "company" });
    const subsidiary = await fixtures.Entity({
      kind: "company",
      ownerId: company.id,
    });
    const brand = await fixtures.Entity({ kind: "brand" });
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.entities.update(
      { entity: brand.id, ownerId: subsidiary.id },
      { context: { user: modUser } },
    );

    expect(data.ownerId).toBe(subsidiary.id);
    expect(
      await db.query.entities.findFirst({
        where: eq(entities.id, subsidiary.id),
      }),
    ).toMatchObject({ ownerId: company.id });
  });

  test("rejects self ownership", async ({ fixtures }) => {
    const entity = await fixtures.Entity();
    const modUser = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.entities.update(
        { entity: entity.id, ownerId: entity.id },
        { context: { user: modUser } },
      ),
    );

    expect(err.message).toBe("An Entity cannot own itself.");
  });

  test("rejects an ownership loop", async ({ fixtures }) => {
    const owner = await fixtures.Entity();
    const owned = await fixtures.Entity({ ownerId: owner.id });
    const modUser = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.entities.update(
        { entity: owner.id, ownerId: owned.id },
        { context: { user: modUser } },
      ),
    );

    expect(err.message).toBe("The owner would create an ownership loop.");
    expect(
      await db.query.entities.findFirst({ where: eq(entities.id, owner.id) }),
    ).toMatchObject({ ownerId: null });
  });

  test("rejects an unknown current owner", async ({ fixtures }) => {
    const entity = await fixtures.Entity();
    const modUser = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.entities.update(
        { entity: entity.id, ownerId: 999999 },
        { context: { user: modUser } },
      ),
    );

    expect(err.message).toBe("Owner not found.");
  });

  test("brand name change rematerializes each group once while preserving exact identity", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Foo",
      type: ["brand", "distiller"],
    });
    const first = await fixtures.Bottle({
      brandId: entity.id,
      name: "Core",
    });
    const firstGroupId = requireGroupId(first.groupId);
    const second = await fixtures.BottleGroupMember({
      groupId: firstGroupId,
      edition: "Batch Two",
    });
    const otherGroup = await fixtures.Bottle({
      brandId: entity.id,
      name: "Reserve",
    });
    const otherGroupId = requireGroupId(otherGroup.groupId);
    const distillerOnlyBottle = await fixtures.Bottle({
      distillerIds: [entity.id],
    });
    const originalBottles = [first, second, otherGroup];
    expect(new Set(originalBottles.map(({ groupId }) => groupId))).toEqual(
      new Set([first.groupId, otherGroup.groupId]),
    );

    await db.insert(bottleAliases).values({
      name: "New Foo Reserve",
      bottleId: null,
      assignedByActorId: otherGroup.createdByActorId,
    });

    const modUser = await fixtures.User({ mod: true });
    const data = await routerClient.entities.update(
      {
        entity: entity.id,
        name: "New Foo",
      },
      { context: { user: modUser } },
    );

    const [newEntity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, data.id));
    expect(newEntity.name).toBe("New Foo");

    const updatedBottles = await db
      .select()
      .from(bottles)
      .where(
        inArray(
          bottles.id,
          originalBottles.map(({ id }) => id),
        ),
      );
    expect(updatedBottles).toHaveLength(3);
    for (const original of originalBottles) {
      const updated = updatedBottles.find(({ id }) => id === original.id);
      expect(updated).toMatchObject({
        id: original.id,
        groupId: original.groupId,
        brandId: entity.id,
      });
      expect(updated?.fullName).toMatch(/^New Foo /);

      const aliases = await db
        .select()
        .from(bottleAliases)
        .where(eq(bottleAliases.bottleId, original.id));
      expect(aliases).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: original.fullName,
          }),
          expect.objectContaining({
            name: updated?.fullName,
          }),
        ]),
      );
    }

    const groups = await db
      .select()
      .from(bottleGroups)
      .where(inArray(bottleGroups.id, [firstGroupId, otherGroupId]));
    expect(groups.map(({ fullName }) => fullName)).toEqual(
      expect.arrayContaining(["New Foo Core", "New Foo Reserve"]),
    );

    const [unchangedDistillerBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, distillerOnlyBottle.id));
    expect(unchangedDistillerBottle.fullName).toEqual(
      distillerOnlyBottle.fullName,
    );
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

    const newAlias = await db.query.bottleAliases.findFirst({
      where: and(
        eq(bottleAliases.bottleId, bottle.id),
        eq(bottleAliases.name, newBottle.fullName),
      ),
    });
    expect(newAlias).toMatchObject({
      name: newBottle.fullName,
      bottleId: bottle.id,
    });

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

  test("rejects a rename that would claim another entity alias", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Original Distillery",
    });
    const aliasOwner = await fixtures.Entity({
      name: "Alias Owner",
    });
    await fixtures.EntityAlias({
      entityId: aliasOwner.id,
      name: "Mars Shinshu",
    });

    const modUser = await fixtures.User({ mod: true });
    const err = await waitError(
      routerClient.entities.update(
        {
          entity: entity.id,
          name: "Mars Shinshu",
        },
        { context: { user: modUser } },
      ),
    );

    expect(err.message).toBe(
      `Duplicate entity alias found (${aliasOwner.id}) for "Mars Shinshu".`,
    );

    const [unchangedEntity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, entity.id));
    expect(unchangedEntity.name).toBe("Original Distillery");

    const conflictingAlias = await db.query.entityAliases.findFirst({
      where: eq(entityAliases.name, "Mars Shinshu"),
    });
    expect(conflictingAlias?.entityId).toBe(aliasOwner.id);
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
    expect(oldBottleAlias).toMatchObject({
      bottleId: bottle.id,
    });

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
    expect(oldShortNameAlias).toMatchObject({
      bottleId: bottle.id,
    });

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

  test("grouped alias collision rolls back the entity and every Bottle identity", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Original Brand",
      type: ["brand"],
    });
    const bottle = await fixtures.Bottle({
      brandId: entity.id,
      name: "Core",
    });
    const conflictingBottle = await fixtures.Bottle();
    const conflictingAlias = await fixtures.BottleAlias({
      bottleId: conflictingBottle.id,
      name: "Renamed Brand Core",
    });
    const modUser = await fixtures.User({ mod: true });

    const error = await waitError(
      routerClient.entities.update(
        { entity: entity.id, name: "Renamed Brand" },
        { context: { user: modUser } },
      ),
    );
    expect(error.message).toBe(
      "Bottle identity conflicts with an existing Bottle.",
    );

    const unchangedEntity = await db.query.entities.findFirst({
      where: eq(entities.id, entity.id),
    });
    const unchangedBottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, bottle.id),
    });
    const retainedConflict = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, conflictingAlias.name),
    });
    expect(unchangedEntity?.name).toBe("Original Brand");
    expect(unchangedBottle?.fullName).toBe("Original Brand Core");
    expect(retainedConflict).toMatchObject({
      bottleId: conflictingBottle.id,
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, "Renamed Brand Core"),
      }),
    ).toEqual(retainedConflict);
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
});
