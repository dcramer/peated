import { beforeEach, describe, expect, it } from "vitest";
import { serialize } from ".";
import { db } from "../db";
import {
  bottles,
  bottleSeries,
  bottlesToDistillers,
  collectionBottles,
  collections,
  entities,
  users,
} from "../db/schema";
import { RESERVED_COLLECTIONS } from "../lib/db";
import { Entity, User } from "../lib/test/fixtures";
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
    it("should be false when another user has favorited the bottle", async () => {
      // Create two users - one who will favorite the bottle and one who will view it
      const favoriter = await User();
      const viewer = await User();

      // Create a brand entity for the bottle
      const brand = await Entity({
        name: "Test Brand",
        type: ["brand"],
        createdById: favoriter.id,
      });

      // Create a bottle
      const [bottle] = await db
        .insert(bottles)
        .values({
          brandId: brand.id,
          name: "Test Bottle",
          fullName: "Test Brand Test Bottle",
          createdById: favoriter.id,
        })
        .returning();

      // Create default collection for the favoriter
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

      // Serialize the bottle for the viewer
      const [result] = await serialize(BottleSerializer, [bottle], viewer);

      // The bottle should not be marked as favorite for the viewer
      expect(result.isFavorite).toBe(false);
    });

    it("should reflect the current user's legacy default collection", async () => {
      const viewer = await User();

      const brand = await Entity({
        name: "Legacy Brand",
        type: ["brand"],
        createdById: viewer.id,
      });

      const [bottle] = await db
        .insert(bottles)
        .values({
          brandId: brand.id,
          name: "Legacy Bottle",
          fullName: "Legacy Brand Legacy Bottle",
          createdById: viewer.id,
        })
        .returning();

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
    it("should reflect the current user's library collection only", async () => {
      const owner = await User();
      const viewer = await User();

      const brand = await Entity({
        name: "Library Brand",
        type: ["brand"],
        createdById: owner.id,
      });

      const [bottle] = await db
        .insert(bottles)
        .values({
          brandId: brand.id,
          name: "Library Bottle",
          fullName: "Library Brand Library Bottle",
          createdById: owner.id,
        })
        .returning();

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

  it("serializes a bottle with and without a series", async function ({
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

    const results = await serialize(BottleSerializer, [
      bottleWithSeries,
      bottleWithoutSeries,
    ]);

    expect(results).toHaveLength(2);

    // Check bottle with series
    expect(results[0]).toMatchObject({
      id: bottleWithSeries.id,
      name: bottleWithSeries.name,
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
  });

  it("serializes the number of tracked bottlings", async function ({
    fixtures,
  }) {
    const bottle = await fixtures.Bottle();

    await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 24",
    });
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "S2B13",
    });
    await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Store Pick",
    });

    const [result] = await serialize(BottleSerializer, [bottle]);

    expect(result.numReleases).toBe(3);
  });
});
