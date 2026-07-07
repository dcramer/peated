import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /users/:user/activity", () => {
  test("returns tastings as primary activity", async ({
    defaults,
    fixtures,
  }) => {
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
      createdAt: new Date("2026-01-03T12:00:00Z"),
    });

    const result = await routerClient.users.activity.list({
      user: defaults.user.username,
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      id: `tasting:${tasting.id}`,
      type: "tasting",
      priority: "primary",
      createdAt: "2026-01-03T12:00:00.000Z",
      tasting: {
        id: tasting.id,
      },
    });
  });

  test("fills pages with tastings when no secondary activity exists", async ({
    defaults,
    fixtures,
  }) => {
    for (let i = 0; i < 12; i++) {
      await fixtures.Tasting({
        createdById: defaults.user.id,
        createdAt: new Date(`2026-01-03T${String(i).padStart(2, "0")}:00:00Z`),
      });
    }

    const firstPage = await routerClient.users.activity.list({
      user: defaults.user.username,
      limit: 10,
    });
    const secondPage = await routerClient.users.activity.list({
      user: defaults.user.username,
      cursor: firstPage.rel.nextCursor ?? 2,
      limit: 10,
    });

    expect(firstPage.results).toHaveLength(10);
    expect(firstPage.results.every((entry) => entry.type === "tasting")).toBe(
      true,
    );
    expect(firstPage.rel.nextCursor).toBe(2);
    expect(secondPage.results).toHaveLength(2);
    expect(secondPage.rel.nextCursor).toBeNull();
  });

  test("groups additions to the same collection", async ({
    defaults,
    fixtures,
  }) => {
    const collection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const bottles = await Promise.all([
      fixtures.Bottle(),
      fixtures.Bottle(),
      fixtures.Bottle(),
      fixtures.Bottle(),
      fixtures.Bottle(),
      fixtures.Bottle(),
    ]);

    await db.insert(collectionBottles).values(
      bottles.map((bottle, index) => ({
        collectionId: collection.id,
        bottleId: bottle.id,
        createdAt: new Date(`2026-01-03T1${index}:00:00Z`),
      })),
    );

    const result = await routerClient.users.activity.list({
      user: defaults.user.username,
    });

    expect(result.results).toHaveLength(1);
    const [entry] = result.results;
    expect(entry).toMatchObject({
      type: "collection_add",
      priority: "secondary",
      createdAt: "2026-01-03T15:00:00.000Z",
      windowStart: "2026-01-03T10:00:00.000Z",
      windowEnd: "2026-01-03T15:00:00.000Z",
      collection: {
        id: collection.id,
        name: "Library",
        href: `/users/${defaults.user.username}/library`,
      },
      totalItems: 6,
    });
    expect(entry.type === "collection_add" ? entry.items : []).toHaveLength(4);
  });

  test("keeps collection additions in separate time windows", async ({
    defaults,
    fixtures,
  }) => {
    const collection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const [firstBottle, secondBottle] = await Promise.all([
      fixtures.Bottle(),
      fixtures.Bottle(),
    ]);

    await db.insert(collectionBottles).values([
      {
        collectionId: collection.id,
        bottleId: firstBottle.id,
        createdAt: new Date("2026-01-03T12:00:00Z"),
      },
      {
        collectionId: collection.id,
        bottleId: secondBottle.id,
        createdAt: new Date("2026-01-04T12:00:00Z"),
      },
    ]);

    const result = await routerClient.users.activity.list({
      user: defaults.user.username,
    });

    const collectionEntries = result.results.filter(
      (entry) => entry.type === "collection_add",
    );
    expect(collectionEntries).toHaveLength(2);
    expect(
      collectionEntries.map((entry) => ({
        createdAt: entry.createdAt,
        totalItems: entry.totalItems,
        windowStart: entry.windowStart,
        windowEnd: entry.windowEnd,
      })),
    ).toEqual([
      {
        createdAt: "2026-01-04T12:00:00.000Z",
        totalItems: 1,
        windowStart: "2026-01-04T12:00:00.000Z",
        windowEnd: "2026-01-04T12:00:00.000Z",
      },
      {
        createdAt: "2026-01-03T12:00:00.000Z",
        totalItems: 1,
        windowStart: "2026-01-03T12:00:00.000Z",
        windowEnd: "2026-01-03T12:00:00.000Z",
      },
    ]);
  });

  test("keeps additions to different collections separate", async ({
    defaults,
    fixtures,
  }) => {
    const [library, favorites] = await Promise.all([
      fixtures.Collection({
        name: "Library",
        createdById: defaults.user.id,
      }),
      fixtures.Collection({
        name: "Default",
        createdById: defaults.user.id,
      }),
    ]);
    const [libraryBottle, favoriteBottle] = await Promise.all([
      fixtures.Bottle(),
      fixtures.Bottle(),
    ]);

    await db.insert(collectionBottles).values([
      {
        collectionId: library.id,
        bottleId: libraryBottle.id,
        createdAt: new Date("2026-01-03T12:00:00Z"),
      },
      {
        collectionId: favorites.id,
        bottleId: favoriteBottle.id,
        createdAt: new Date("2026-01-03T12:00:00Z"),
      },
    ]);

    const result = await routerClient.users.activity.list({
      user: defaults.user.username,
    });

    const collectionEntries = result.results.filter(
      (entry) => entry.type === "collection_add",
    );
    expect(collectionEntries).toHaveLength(2);
    expect(
      collectionEntries.map((entry) => entry.collection.name).sort(),
    ).toEqual(["Default", "Library"]);
  });

  test("links legacy default collection activity to favorites", async ({
    defaults,
    fixtures,
  }) => {
    const collection = await fixtures.Collection({
      name: "Personal Favorites",
      createdById: defaults.user.id,
    });
    const bottle = await fixtures.Bottle();

    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: bottle.id,
      createdAt: new Date("2026-01-03T12:00:00Z"),
    });

    const result = await routerClient.users.activity.list({
      user: defaults.user.username,
    });

    expect(result.results[0]).toMatchObject({
      type: "collection_add",
      collection: {
        id: collection.id,
        name: "Personal Favorites",
        href: `/users/${defaults.user.username}/favorites`,
      },
    });
  });

  test("does not count duplicate collection add attempts", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );
    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    const result = await routerClient.users.activity.list({
      user: defaults.user.username,
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      type: "collection_add",
      totalItems: 1,
    });
  });

  test("caps secondary entries when primary activity exists", async ({
    defaults,
    fixtures,
  }) => {
    for (let i = 0; i < 3; i++) {
      await fixtures.Tasting({
        createdById: defaults.user.id,
        createdAt: new Date(`2026-01-03T1${i}:30:00Z`),
      });
    }

    for (let i = 0; i < 4; i++) {
      const collection = await fixtures.Collection({
        name: `Shelf ${i}`,
        createdById: defaults.user.id,
      });
      const bottle = await fixtures.Bottle();
      await db.insert(collectionBottles).values({
        collectionId: collection.id,
        bottleId: bottle.id,
        createdAt: new Date(`2026-01-03T1${i}:00:00Z`),
      });
    }

    const result = await routerClient.users.activity.list({
      user: defaults.user.username,
      limit: 10,
    });

    expect(
      result.results.filter((entry) => entry.type === "tasting"),
    ).toHaveLength(3);
    expect(
      result.results.filter((entry) => entry.type === "collection_add"),
    ).toHaveLength(2);
  });

  test("paginates remaining secondary entries when primary activity exists", async ({
    defaults,
    fixtures,
  }) => {
    await fixtures.Tasting({
      createdById: defaults.user.id,
      createdAt: new Date("2026-01-03T12:30:00Z"),
    });

    for (let i = 0; i < 4; i++) {
      const collection = await fixtures.Collection({
        name: `Shelf ${i}`,
        createdById: defaults.user.id,
      });
      const bottle = await fixtures.Bottle();
      await db.insert(collectionBottles).values({
        collectionId: collection.id,
        bottleId: bottle.id,
        createdAt: new Date(`2026-01-03T1${i}:00:00Z`),
      });
    }

    const firstPage = await routerClient.users.activity.list({
      user: defaults.user.username,
      limit: 3,
    });
    const secondPage = await routerClient.users.activity.list({
      user: defaults.user.username,
      cursor: firstPage.rel.nextCursor ?? 2,
      limit: 3,
    });

    expect(
      firstPage.results.filter((entry) => entry.type === "tasting"),
    ).toHaveLength(1);
    expect(
      firstPage.results.filter((entry) => entry.type === "collection_add"),
    ).toHaveLength(2);
    expect(firstPage.rel.nextCursor).toBe(2);
    expect(secondPage.results).toHaveLength(2);
    expect(
      secondPage.results.every((entry) => entry.type === "collection_add"),
    ).toBe(true);
    expect(secondPage.rel.nextCursor).toBeNull();
  });

  test("paginates mixed activity with limit one", async ({
    defaults,
    fixtures,
  }) => {
    await fixtures.Tasting({
      createdById: defaults.user.id,
      createdAt: new Date("2026-01-03T12:30:00Z"),
    });
    const collection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const bottle = await fixtures.Bottle();
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: bottle.id,
      createdAt: new Date("2026-01-03T12:00:00Z"),
    });

    const firstPage = await routerClient.users.activity.list({
      user: defaults.user.username,
      limit: 1,
    });
    const secondPage = await routerClient.users.activity.list({
      user: defaults.user.username,
      cursor: firstPage.rel.nextCursor ?? 2,
      limit: 1,
    });

    expect(firstPage.results).toHaveLength(1);
    expect(firstPage.results[0].type).toBe("tasting");
    expect(firstPage.rel.nextCursor).toBe(2);
    expect(secondPage.results).toHaveLength(1);
    expect(secondPage.results[0].type).toBe("collection_add");
    expect(secondPage.rel.nextCursor).toBeNull();
  });

  test("shows grouped collection activity when no tastings exist", async ({
    defaults,
    fixtures,
  }) => {
    const collection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const bottle = await fixtures.Bottle();
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: bottle.id,
      createdAt: new Date("2026-01-03T12:00:00Z"),
    });

    const result = await routerClient.users.activity.list({
      user: defaults.user.username,
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      type: "collection_add",
      priority: "secondary",
    });
  });

  test("preserves private profile visibility", async ({ fixtures }) => {
    const privateUser = await fixtures.User({ private: true });
    await fixtures.Tasting({ createdById: privateUser.id });

    const err = await waitError(() =>
      routerClient.users.activity.list({
        user: privateUser.username,
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: User's profile is private.]`);
  });
});
