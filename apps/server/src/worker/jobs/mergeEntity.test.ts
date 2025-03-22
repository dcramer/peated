import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottles,
  entities,
  entityTombstones,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import mergeEntity from "./mergeEntity";

test("merge A into B", async ({ fixtures }) => {
  const entityA = await fixtures.Entity({
    name: "Entity A",
    totalTastings: 1,
    totalBottles: 2,
  });
  const entityB = await fixtures.Entity({
    name: "Entity B",
    totalTastings: 3,
    totalBottles: 1,
  });

  await mergeEntity({
    fromEntityIds: [entityA.id],
    toEntityId: entityB.id,
  });

  const [newEntityA] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityA.id));
  expect(newEntityA).toBeUndefined();

  const [newEntityB] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityB.id));
  expect(newEntityB).toBeDefined();

  const [tombstone] = await db
    .select()
    .from(entityTombstones)
    .where(eq(entityTombstones.entityId, entityA.id));
  expect(tombstone.newEntityId).toEqual(newEntityB.id);
});

test("merge A from B", async ({ fixtures }) => {
  const entityA = await fixtures.Entity({
    name: "Entity A",
    totalTastings: 1,
    totalBottles: 2,
  });
  const entityB = await fixtures.Entity({
    name: "Entity B",
    totalTastings: 3,
    totalBottles: 1,
  });

  await mergeEntity({
    fromEntityIds: [entityB.id],
    toEntityId: entityA.id,
  });

  const [newEntityA] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityA.id));
  expect(newEntityA).toBeDefined();

  const [newEntityB] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityB.id));
  expect(newEntityB).toBeUndefined();

  const [tombstone] = await db
    .select()
    .from(entityTombstones)
    .where(eq(entityTombstones.entityId, entityB.id));
  expect(tombstone.newEntityId).toEqual(newEntityA.id);
});

test("merge duplicate bottle", async ({ fixtures }) => {
  const entityA = await fixtures.Entity({
    name: "Entity A",
    totalTastings: 1,
    totalBottles: 2,
  });
  const bottleA = await fixtures.Bottle({
    brandId: entityA.id,
    name: "Duplicate",
  });
  const entityB = await fixtures.Entity({
    name: "Entity B",
    totalTastings: 3,
    totalBottles: 1,
  });
  const bottleB = await fixtures.Bottle({
    brandId: entityB.id,
    name: "Duplicate",
  });

  await mergeEntity({
    fromEntityIds: [entityA.id],
    toEntityId: entityB.id,
  });

  const [newBottleA] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleA.id));
  expect(newBottleA).toBeUndefined();

  const [newBottleB] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleB.id));
  expect(newBottleB).toBeDefined();
  expect(newBottleB.name).toEqual("Duplicate");
});

test("merge unique bottle", async ({ fixtures }) => {
  const entityA = await fixtures.Entity({
    name: "Entity A",
    totalTastings: 1,
    totalBottles: 2,
  });
  const bottleA = await fixtures.Bottle({
    brandId: entityA.id,
    name: "Unique",
    statedAge: null,
  });
  const entityB = await fixtures.Entity({
    name: "Entity B",
    totalTastings: 3,
    totalBottles: 1,
  });
  const bottleB = await fixtures.Bottle({
    brandId: entityB.id,
    name: "More Unique",
    statedAge: null,
  });

  await mergeEntity({
    fromEntityIds: [entityA.id],
    toEntityId: entityB.id,
  });

  const [newBottleA] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleA.id));
  expect(newBottleA).toBeDefined();
  expect(newBottleA.brandId).toEqual(entityB.id);
  expect(newBottleA.name).toEqual("Unique");

  const [newBottleB] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleB.id));
  expect(newBottleB).toBeDefined();
  expect(newBottleB.brandId).toEqual(entityB.id);
  expect(newBottleB.name).toEqual("More Unique");
});

test("updates bottle releases when merging entities", async ({ fixtures }) => {
  const entityA = await fixtures.Entity({
    name: "Entity A",
    totalTastings: 1,
    totalBottles: 2,
  });
  const entityB = await fixtures.Entity({
    name: "Entity B",
    totalTastings: 3,
    totalBottles: 1,
  });

  // Create a bottle with releases under entityA
  const bottle = await fixtures.Bottle({
    brandId: entityA.id,
    name: "Test Bottle",
    statedAge: null,
  });

  // Create releases for the bottle
  const release1 = await fixtures.BottleRelease({
    bottleId: bottle.id,
    edition: "Batch 1",
    abv: 43.0,
    statedAge: 12,
    releaseYear: 2020,
    vintageYear: 2008,
  });

  const release2 = await fixtures.BottleRelease({
    bottleId: bottle.id,
    edition: "Limited Edition",
    abv: 46.0,
    statedAge: null,
    releaseYear: 2021,
    vintageYear: null,
  });

  await mergeEntity({
    fromEntityIds: [entityA.id],
    toEntityId: entityB.id,
  });

  // Verify entityA is deleted
  const [newEntityA] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityA.id));
  expect(newEntityA).toBeUndefined();

  // Verify entityB exists
  const [newEntityB] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityB.id));
  expect(newEntityB).toBeDefined();

  // Verify bottle was moved to entityB
  const [updatedBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));
  expect(updatedBottle.brandId).toBe(entityB.id);
  expect(updatedBottle.fullName).toBe(`${entityB.name} Test Bottle`);

  // Verify releases were updated with new fullName
  const [updatedRelease1] = await db
    .select()
    .from(bottleReleases)
    .where(eq(bottleReleases.id, release1.id));

  const [updatedRelease2] = await db
    .select()
    .from(bottleReleases)
    .where(eq(bottleReleases.id, release2.id));

  expect(updatedRelease1.fullName).toBe(
    `${entityB.name} Test Bottle - Batch 1 - 12-year-old - 2020 Release - 2008 Vintage - 43.0% ABV`,
  );
  expect(updatedRelease2.fullName).toBe(
    `${entityB.name} Test Bottle - Limited Edition - 2021 Release - 46.0% ABV`,
  );

  // Verify tombstone was created
  const [tombstone] = await db
    .select()
    .from(entityTombstones)
    .where(eq(entityTombstones.entityId, entityA.id));
  expect(tombstone.newEntityId).toEqual(entityB.id);
});

test("handles duplicate bottles during entity merge", async ({ fixtures }) => {
  const entityA = await fixtures.Entity({
    name: "Entity A",
    totalTastings: 1,
    totalBottles: 2,
  });
  const entityB = await fixtures.Entity({
    name: "Entity B",
    totalTastings: 3,
    totalBottles: 1,
  });

  // Create bottles with same name under different entities
  const bottleA = await fixtures.Bottle({
    brandId: entityA.id,
    name: "Duplicate",
    statedAge: null,
  });

  const bottleB = await fixtures.Bottle({
    brandId: entityB.id,
    name: "Duplicate",
    statedAge: null,
  });

  // Create releases for bottleA
  const release = await fixtures.BottleRelease({
    bottleId: bottleA.id,
    edition: "Batch 1",
    abv: 43.0,
    statedAge: null,
    releaseYear: null,
    vintageYear: null,
  });

  await mergeEntity({
    fromEntityIds: [entityA.id],
    toEntityId: entityB.id,
  });

  // Verify bottleA was merged into bottleB
  const [newBottleA] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottleA.id));
  expect(newBottleA).toBeUndefined();

  // Verify release was moved to bottleB
  const [updatedRelease] = await db
    .select()
    .from(bottleReleases)
    .where(eq(bottleReleases.id, release.id));
  expect(updatedRelease.bottleId).toBe(bottleB.id);
  expect(updatedRelease.fullName).toBe(
    `${entityB.name} Duplicate - Batch 1 - 43.0% ABV`,
  );
});

describe("mergeEntity", () => {
  it("merges entities and updates bottle names", async ({ fixtures }) => {
    const entityA = await fixtures.Entity({
      name: "Test Entity A",
      type: ["brand"],
    });
    const entityB = await fixtures.Entity({
      name: "Test Entity B",
      type: ["brand"],
    });

    const bottleA = await fixtures.Bottle({
      brandId: entityA.id,
      name: "Test Bottle A",
      category: "single_malt",
    });

    const bottleB = await fixtures.Bottle({
      brandId: entityA.id,
      name: "Test Bottle B",
      category: "single_malt",
    });

    await mergeEntity({
      toEntityId: entityB.id,
      fromEntityIds: [entityA.id],
    });

    const updatedBottles = await db
      .select()
      .from(bottles)
      .where(eq(bottles.brandId, entityB.id));

    expect(updatedBottles).toHaveLength(2);
    expect(updatedBottles[0].fullName).toBe("Test Entity B Test Bottle A");
    expect(updatedBottles[1].fullName).toBe("Test Entity B Test Bottle B");
  });

  it("merges entities and updates release names", async ({ fixtures }) => {
    const entityA = await fixtures.Entity({
      name: "Test Entity A",
      type: ["brand"],
    });
    const entityB = await fixtures.Entity({
      name: "Test Entity B",
      type: ["brand"],
    });

    const bottleA = await fixtures.Bottle({
      brandId: entityA.id,
      name: "Test Bottle A",
      category: "single_malt",
      statedAge: null,
    });

    const releaseA = await fixtures.BottleRelease({
      bottleId: bottleA.id,
      edition: "Batch 1",
      abv: 46.0,
      statedAge: 12,
      releaseYear: 2020,
      vintageYear: 2008,
    });

    const releaseB = await fixtures.BottleRelease({
      bottleId: bottleA.id,
      edition: "Batch 2",
      abv: null,
      statedAge: 12,
      releaseYear: null,
      vintageYear: null,
    });

    await mergeEntity({
      toEntityId: entityB.id,
      fromEntityIds: [entityA.id],
    });

    const updatedReleases = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.bottleId, bottleA.id));

    expect(updatedReleases).toHaveLength(2);
    expect(updatedReleases[0].name).toBe(
      "Test Bottle A - Batch 1 - 12-year-old - 2020 Release - 2008 Vintage - 46.0% ABV",
    );
    expect(updatedReleases[0].fullName).toBe(
      "Test Entity B Test Bottle A - Batch 1 - 12-year-old - 2020 Release - 2008 Vintage - 46.0% ABV",
    );
    expect(updatedReleases[1].name).toBe(
      "Test Bottle A - Batch 2 - 12-year-old",
    );
    expect(updatedReleases[1].fullName).toBe(
      "Test Entity B Test Bottle A - Batch 2 - 12-year-old",
    );
  });

  it("merges entities and updates release names with bottle age statement", async ({
    fixtures,
  }) => {
    const entityA = await fixtures.Entity({
      name: "Test Entity A",
      type: ["brand"],
    });
    const entityB = await fixtures.Entity({
      name: "Test Entity B",
      type: ["brand"],
    });

    const bottleA = await fixtures.Bottle({
      brandId: entityA.id,
      name: "Test Bottle A",
      category: "single_malt",
      statedAge: 12,
    });

    const releaseA = await fixtures.BottleRelease({
      bottleId: bottleA.id,
      edition: "Batch 1",
      abv: 46.0,
      statedAge: 12,
      releaseYear: 2020,
      vintageYear: 2008,
    });

    await mergeEntity({
      toEntityId: entityB.id,
      fromEntityIds: [entityA.id],
    });

    const updatedReleases = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.bottleId, bottleA.id));

    expect(updatedReleases).toHaveLength(1);
    expect(updatedReleases[0].name).toBe(
      "Test Bottle A - Batch 1 - 2020 Release - 2008 Vintage - 46.0% ABV",
    );
    expect(updatedReleases[0].fullName).toBe(
      "Test Entity B Test Bottle A - Batch 1 - 2020 Release - 2008 Vintage - 46.0% ABV",
    );
  });
});
