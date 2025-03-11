import { beforeEach, describe, expect, it } from "vitest";
import { serialize } from ".";
import { db } from "../db";
import {
  bottles,
  bottlesToDistillers,
  collectionBottles,
  collections,
  entities,
  users,
} from "../db/schema";
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
          name: "Default",
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
  });
});
