import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { serialize } from ".";
import { db } from "../db";
import {
  bottleGroups,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  collectionBottles,
  collections,
  entities,
  users,
} from "../db/schema";
import { RESERVED_COLLECTIONS } from "../lib/db";
import { BottleSchema } from "../schemas";
import { BottleSerializer } from "./bottle";

describe("BottleSerializer", () => {
  beforeEach(async () => {
    await db.delete(collectionBottles);
    await db.delete(collections);
    await db.delete(bottlesToDistillers);
    await db.delete(bottles);
    await db.delete(entities);
    await db.delete(users);
  });

  describe("isFavorite", () => {
    it("should be false when another user has favorited the bottle", async ({
      fixtures,
    }) => {
      const favoriter = await fixtures.User();
      const viewer = await fixtures.User();
      const bottle = await fixtures.Bottle();

      const [collection] = await db
        .insert(collections)
        .values({
          name: RESERVED_COLLECTIONS.default.name,
          createdById: favoriter.id,
        })
        .returning();

      // Add bottle to favoriter's collection
      await db.insert(collectionBottles).values({
        bottleId: bottle.id,
        collectionId: collection.id,
      });

      const [result] = await serialize(BottleSerializer, [bottle], viewer);

      expect(result.isFavorite).toBe(false);
    });

    it("should reflect the current user's legacy default collection", async ({
      fixtures,
    }) => {
      const viewer = await fixtures.User();
      const bottle = await fixtures.Bottle({ name: "Legacy Bottle" });

      const [legacyCollection] = await db
        .insert(collections)
        .values({
          name: "Personal Favorites",
          createdById: viewer.id,
        })
        .returning();

      await db.insert(collectionBottles).values({
        bottleId: bottle.id,
        collectionId: legacyCollection.id,
      });

      const [result] = await serialize(BottleSerializer, [bottle], viewer);

      expect(result.isFavorite).toBe(true);
      expect(result.isLibrary).toBe(false);
    });
  });

  describe("isLibrary", () => {
    it("should reflect the current user's library collection only", async ({
      fixtures,
    }) => {
      const owner = await fixtures.User();
      const viewer = await fixtures.User();
      const bottle = await fixtures.Bottle({ name: "Library Bottle" });

      const [ownerLibrary] = await db
        .insert(collections)
        .values({
          name: RESERVED_COLLECTIONS.library.name,
          createdById: owner.id,
        })
        .returning();

      await db.insert(collectionBottles).values({
        bottleId: bottle.id,
        collectionId: ownerLibrary.id,
      });

      const [otherUserResult] = await serialize(
        BottleSerializer,
        [bottle],
        viewer,
      );

      expect(otherUserResult.isLibrary).toBe(false);

      const [viewerLibrary] = await db
        .insert(collections)
        .values({
          name: RESERVED_COLLECTIONS.library.name,
          createdById: viewer.id,
        })
        .returning();

      await db.insert(collectionBottles).values({
        bottleId: bottle.id,
        collectionId: viewerLibrary.id,
      });

      const [result] = await serialize(BottleSerializer, [bottle], viewer);

      expect(result.isLibrary).toBe(true);
      expect(result.isFavorite).toBe(false);
    });
  });

  it("derives actor state directly from Bottle identity", async ({
    fixtures,
  }) => {
    const viewer = await fixtures.User();
    const selectedBottle = await fixtures.Bottle({ name: "Selected Bottle" });
    const otherBottle = await fixtures.Bottle({ name: "Other Bottle" });

    const [favorites, library] = await db
      .insert(collections)
      .values([
        {
          name: RESERVED_COLLECTIONS.default.name,
          createdById: viewer.id,
        },
        {
          name: RESERVED_COLLECTIONS.library.name,
          createdById: viewer.id,
        },
      ])
      .returning();

    await db.insert(collectionBottles).values([
      {
        collectionId: favorites.id,
        bottleId: selectedBottle.id,
      },
      {
        collectionId: library.id,
        bottleId: otherBottle.id,
      },
    ]);
    await fixtures.Tasting({
      bottleId: selectedBottle.id,
      createdById: viewer.id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await fixtures.Tasting({
      bottleId: otherBottle.id,
      createdById: viewer.id,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const [exactResult, otherResult] = await serialize(
      BottleSerializer,
      [selectedBottle, otherBottle],
      viewer,
    );
    expect(exactResult).toMatchObject({
      isFavorite: true,
      isLibrary: false,
      hasTasted: true,
    });
    expect(otherResult).toMatchObject({
      isFavorite: false,
      isLibrary: true,
      hasTasted: true,
    });

    const anonymousResults = await serialize(BottleSerializer, [
      selectedBottle,
    ]);
    expect(anonymousResults[0]).toMatchObject({
      isFavorite: false,
      isLibrary: false,
      hasTasted: false,
    });
  });

  it("serializes an independently complete bottle and its group summary", async function ({
    fixtures,
  }) {
    const brand = await fixtures.Entity({ name: "Ardbeg" });
    const series = await fixtures.BottleSeries({
      name: "Supernova",
      description: "A limited edition series",
      brandId: brand.id,
    });

    const bottleWithSeries = await fixtures.Bottle({
      name: "Supernova",
      brandId: brand.id,
      seriesId: series.id,
    });

    const bottleWithoutSeries = await fixtures.Bottle({
      name: "10 Year Old",
      brandId: brand.id,
    });

    const results = await serialize(
      BottleSerializer,
      [bottleWithSeries, bottleWithoutSeries],
      undefined,
      [],
      { includeGroupSummary: true },
    );

    expect(results).toHaveLength(2);

    // Check bottle with series
    expect(results[0]).toMatchObject({
      id: bottleWithSeries.id,
      name: bottleWithSeries.name,
      group: {
        id: bottleWithSeries.groupId,
        representativeBottleId: bottleWithSeries.id,
        totalBottles: 1,
      },
      series: expect.objectContaining({
        id: series.id,
        name: series.name,
        description: series.description,
        brand: expect.objectContaining({
          id: brand.id,
          name: brand.name,
        }),
      }),
    });

    // Check bottle without series
    expect(results[1]).toMatchObject({
      id: bottleWithoutSeries.id,
      name: bottleWithoutSeries.name,
      series: null,
    });
    expect(BottleSchema.safeParse(results[0]).success).toBe(true);
  });

  it("keeps sibling Bottle identity independent from a shared group summary", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Springbank" });
    const first = await fixtures.Bottle({
      brandId: brand.id,
      name: "Batch 23",
      edition: "Batch 23",
      imageUrl: "bottles/batch-23.jpg",
    });
    const second = await fixtures.LegacyBottle({
      brandId: brand.id,
      name: "Batch 24",
      edition: "Batch 24",
      imageUrl: "bottles/batch-24.jpg",
    });

    await db
      .update(bottles)
      .set({ groupId: first.groupId })
      .where(eq(bottles.id, second.id));
    await db
      .update(bottleGroups)
      .set({ totalBottles: 2 })
      .where(eq(bottleGroups.id, first.groupId as number));

    const [firstResult, secondResult] = await serialize(
      BottleSerializer,
      [first, { ...second, groupId: first.groupId }],
      undefined,
      [],
      { includeGroupSummary: true },
    );

    expect(firstResult.group).toEqual(secondResult.group);
    expect(firstResult).toMatchObject({
      name: "Batch 23",
      edition: "Batch 23",
      imageUrl: expect.stringContaining("bottles/batch-23.jpg"),
    });
    expect(secondResult).toMatchObject({
      name: "Batch 24",
      edition: "Batch 24",
      imageUrl: expect.stringContaining("bottles/batch-24.jpg"),
    });
  });

  it("does not expose legacy release fields", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ imageUrl: null });

    const [result] = await serialize(BottleSerializer, [bottle]);

    expect(result.imageUrl).toBeNull();
    expect(result).not.toHaveProperty("displayImageUrl");
    expect(result).not.toHaveProperty("numReleases");
  });

  it("serializes independently without a group unless enrichment is requested", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.LegacyBottle({ name: "Missing Group" });

    const [result] = await serialize(BottleSerializer, [bottle]);

    expect(result).toMatchObject({
      id: bottle.id,
      name: "Missing Group",
      imageUrl: null,
    });
    expect(BottleSchema.safeParse(result).success).toBe(true);
    expect(result).not.toHaveProperty("group");

    await expect(
      serialize(BottleSerializer, [bottle], undefined, [], {
        includeGroupSummary: true,
      }),
    ).rejects.toThrow(
      `Bottle ${bottle.id} does not belong to an active BottleGroup.`,
    );
  });
});
