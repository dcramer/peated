import { db } from "@peated/server/db";
import {
  bottlesToDistillers,
  collectionBottles,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /users/:user/library/stats", () => {
  test("returns empty insights when the Library does not exist", async ({
    defaults,
  }) => {
    const data = await routerClient.users.libraryStats(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data).toMatchObject({
      total: 0,
      distillers: [],
      age: {
        knownCount: 0,
        median: null,
        oldest: null,
      },
      categories: [],
    });
    expect(data.age.buckets.every((bucket) => bucket.count === 0)).toBe(true);
  });

  test("summarizes non-empty Library entries", async ({
    defaults,
    fixtures,
  }) => {
    const library = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const otherCollection = await fixtures.Collection({
      name: "Other Collection",
      createdById: defaults.user.id,
    });
    const distillerA = await fixtures.Entity({ name: "Alpha Distillery" });
    const distillerB = await fixtures.Entity({ name: "Beta Distillery" });
    const youngBottle = await fixtures.Bottle({
      category: "single_malt",
      statedAge: 8,
    });
    const releaseBottle = await fixtures.Bottle({
      category: "bourbon",
      statedAge: 12,
    });
    const release = await fixtures.BottleRelease({
      bottleId: releaseBottle.id,
      statedAge: 18,
    });
    const oldBottle = await fixtures.Bottle({
      category: "single_malt",
      statedAge: 25,
    });
    const unstatedBottle = await fixtures.Bottle({
      category: "rye",
      statedAge: null,
    });
    const emptyBottle = await fixtures.Bottle({
      category: "single_malt",
      statedAge: 50,
    });
    const otherBottle = await fixtures.Bottle({
      category: "single_malt",
      statedAge: 40,
    });

    await db.insert(bottlesToDistillers).values([
      { bottleId: youngBottle.id, distillerId: distillerA.id },
      { bottleId: releaseBottle.id, distillerId: distillerA.id },
      { bottleId: oldBottle.id, distillerId: distillerB.id },
      { bottleId: emptyBottle.id, distillerId: distillerB.id },
      { bottleId: otherBottle.id, distillerId: distillerB.id },
    ]);
    await db.insert(collectionBottles).values([
      {
        collectionId: library.id,
        bottleId: youngBottle.id,
        status: "open",
      },
      {
        collectionId: library.id,
        bottleId: releaseBottle.id,
        releaseId: release.id,
        status: "sealed",
      },
      {
        collectionId: library.id,
        bottleId: oldBottle.id,
        status: null,
      },
      {
        collectionId: library.id,
        bottleId: unstatedBottle.id,
        status: "open",
      },
      {
        collectionId: library.id,
        bottleId: emptyBottle.id,
        status: "empty",
      },
      {
        collectionId: otherCollection.id,
        bottleId: otherBottle.id,
        status: "sealed",
      },
    ]);

    const data = await routerClient.users.libraryStats(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data.total).toBe(4);
    expect(data.distillers).toEqual([
      { id: distillerA.id, name: distillerA.name, count: 2 },
      { id: distillerB.id, name: distillerB.name, count: 1 },
    ]);
    expect(data.age).toEqual({
      knownCount: 3,
      median: 18,
      oldest: 25,
      buckets: [
        { id: "under10", label: "Under 10", count: 1 },
        { id: "from10To12", label: "10–12", count: 0 },
        { id: "from13To17", label: "13–17", count: 0 },
        { id: "from18To24", label: "18–24", count: 1 },
        { id: "atLeast25", label: "25+", count: 1 },
        { id: "unstated", label: "Unstated", count: 1 },
      ],
    });
    expect(data.categories).toEqual([
      { category: "single_malt", count: 2 },
      { category: "bourbon", count: 1 },
      { category: "rye", count: 1 },
    ]);
  });

  test("rejects private Library insights for other users", async ({
    defaults,
    fixtures,
  }) => {
    const privateUser = await fixtures.User({ private: true });

    const error = await waitError(() =>
      routerClient.users.libraryStats(
        { user: privateUser.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: User's profile is private.]`);
  });
});
