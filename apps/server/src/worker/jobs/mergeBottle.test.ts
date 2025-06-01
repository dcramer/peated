import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottleTombstones,
  bottles,
  entities,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import mergeBottle from "./mergeBottle";

describe("mergeBottle", () => {
  it("merge A into B", async ({ fixtures }) => {
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

    const bottleA = await fixtures.Bottle({
      brandId: entityA.id,
      name: "Test Bottle A",
      category: "single_malt",
    });

    const bottleB = await fixtures.Bottle({
      brandId: entityB.id,
      name: "Test Bottle B",
      category: "single_malt",
    });

    await mergeBottle({
      fromBottleIds: [bottleA.id],
      toBottleId: bottleB.id,
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

    const [tombstone] = await db
      .select()
      .from(bottleTombstones)
      .where(eq(bottleTombstones.bottleId, bottleA.id));
    expect(tombstone.newBottleId).toEqual(newBottleB.id);
  });

  it("merge A from B", async ({ fixtures }) => {
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

    const bottleA = await fixtures.Bottle({
      brandId: entityA.id,
      name: "Test Bottle A",
      category: "single_malt",
    });

    const bottleB = await fixtures.Bottle({
      brandId: entityB.id,
      name: "Test Bottle B",
      category: "single_malt",
    });

    await mergeBottle({
      fromBottleIds: [bottleB.id],
      toBottleId: bottleA.id,
    });

    const [newBottleA] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottleA.id));
    expect(newBottleA).toBeDefined();

    const [newBottleB] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottleB.id));
    expect(newBottleB).toBeUndefined();

    const [tombstone] = await db
      .select()
      .from(bottleTombstones)
      .where(eq(bottleTombstones.bottleId, bottleB.id));
    expect(tombstone.newBottleId).toEqual(newBottleA.id);
  });

  it("merge duplicate bottle", async ({ fixtures }) => {
    const entityA = await fixtures.Entity({
      name: "Entity A",
      totalTastings: 1,
      totalBottles: 2,
    });
    const bottleA = await fixtures.Bottle({
      brandId: entityA.id,
      name: "Duplicate",
      category: "single_malt",
    });
    const entityB = await fixtures.Entity({
      name: "Entity B",
      totalTastings: 3,
      totalBottles: 1,
    });
    const bottleB = await fixtures.Bottle({
      brandId: entityB.id,
      name: "Duplicate",
      category: "single_malt",
    });

    await mergeBottle({
      fromBottleIds: [bottleA.id],
      toBottleId: bottleB.id,
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

  it("merge unique bottle", async ({ fixtures }) => {
    const entityA = await fixtures.Entity({
      name: "Entity A",
      totalTastings: 1,
      totalBottles: 2,
    });
    const bottleA = await fixtures.Bottle({
      brandId: entityA.id,
      name: "Unique",
      category: "single_malt",
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
      category: "single_malt",
      statedAge: null,
    });

    await mergeBottle({
      fromBottleIds: [bottleA.id],
      toBottleId: bottleB.id,
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
    expect(newBottleB.brandId).toEqual(entityB.id);
    expect(newBottleB.name).toEqual("More Unique");
  });

  it("updates associated bottle releases when merging bottles", async ({
    fixtures,
  }) => {
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
    const bottleA = await fixtures.Bottle({
      brandId: entityA.id,
      name: "Test Bottle A",
      category: "single_malt",
      statedAge: null,
    });

    const bottleB = await fixtures.Bottle({
      brandId: entityB.id,
      name: "Test Bottle B",
      category: "single_malt",
      statedAge: null,
    });

    // Create releases for bottleA
    const release1 = await fixtures.BottleRelease({
      bottleId: bottleA.id,
      edition: "Batch 1",
      abv: 43.0,
      statedAge: 12,
      releaseYear: 2020,
      vintageYear: 2008,
    });

    const release2 = await fixtures.BottleRelease({
      bottleId: bottleA.id,
      edition: "Limited Edition",
      abv: 46.0,
      statedAge: null,
      releaseYear: 2021,
      vintageYear: null,
    });

    await mergeBottle({
      fromBottleIds: [bottleA.id],
      toBottleId: bottleB.id,
    });

    // Verify bottleA is deleted
    const [newBottleA] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottleA.id));
    expect(newBottleA).toBeUndefined();

    // Verify bottleB exists
    const [newBottleB] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottleB.id));
    expect(newBottleB).toBeDefined();

    // Verify releases were moved to bottleB and names were updated
    const [updatedRelease1] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, release1.id));

    const [updatedRelease2] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, release2.id));

    expect(updatedRelease1.bottleId).toBe(bottleB.id);
    expect(updatedRelease1.name).toBe(
      "Test Bottle B - Batch 1 - 12-year-old - 2020 Release - 2008 Vintage - 43.0% ABV"
    );
    expect(updatedRelease1.fullName).toBe(
      "Entity B Test Bottle B - Batch 1 - 12-year-old - 2020 Release - 2008 Vintage - 43.0% ABV"
    );

    expect(updatedRelease2.bottleId).toBe(bottleB.id);
    expect(updatedRelease2.name).toBe(
      "Test Bottle B - Limited Edition - 2021 Release - 46.0% ABV"
    );
    expect(updatedRelease2.fullName).toBe(
      "Entity B Test Bottle B - Limited Edition - 2021 Release - 46.0% ABV"
    );

    // Verify tombstone was created
    const [tombstone] = await db
      .select()
      .from(bottleTombstones)
      .where(eq(bottleTombstones.bottleId, bottleA.id));
    expect(tombstone.newBottleId).toEqual(bottleB.id);
  });

  it("handles duplicate bottles during merge", async ({ fixtures }) => {
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
      category: "single_malt",
      statedAge: null,
    });

    const bottleB = await fixtures.Bottle({
      brandId: entityB.id,
      name: "Duplicate",
      category: "single_malt",
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

    await mergeBottle({
      fromBottleIds: [bottleA.id],
      toBottleId: bottleB.id,
    });

    // Verify bottleA was merged into bottleB
    const [newBottleA] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottleA.id));
    expect(newBottleA).toBeUndefined();

    // Verify release was moved to bottleB and name was updated
    const [updatedRelease] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, release.id));

    expect(updatedRelease.bottleId).toBe(bottleB.id);
    expect(updatedRelease.name).toBe("Duplicate - Batch 1 - 43.0% ABV");
    expect(updatedRelease.fullName).toBe(
      "Entity B Duplicate - Batch 1 - 43.0% ABV"
    );
  });
});
