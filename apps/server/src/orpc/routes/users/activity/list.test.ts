import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

async function insertCollectionBottles(
  values:
    | typeof collectionBottles.$inferInsert
    | (typeof collectionBottles.$inferInsert)[],
) {
  await db
    .insert(collectionBottles)
    .values(Array.isArray(values) ? values : [values]);
}

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
      id: `tasting_session:${defaults.user.id}:${tasting.id}`,
      type: "tasting_session",
      priority: "primary",
      startedAt: "2026-01-03T12:00:00.000Z",
      lastActivityAt: "2026-01-03T12:00:00.000Z",
      createdBy: {
        id: defaults.user.id,
      },
      tastings: [{ id: tasting.id }],
    });
  });

  test("groups nearby tastings and starts a new session after inactivity", async ({
    defaults,
    fixtures,
  }) => {
    const first = await fixtures.Tasting({
      createdById: defaults.user.id,
      createdAt: new Date("2026-01-03T12:00:00Z"),
    });
    const second = await fixtures.Tasting({
      createdById: defaults.user.id,
      createdAt: new Date("2026-01-03T14:00:00Z"),
    });
    const third = await fixtures.Tasting({
      createdById: defaults.user.id,
      createdAt: new Date("2026-01-03T18:00:00Z"),
    });

    const result = await routerClient.users.activity.list({
      user: defaults.user.username,
    });

    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({
      type: "tasting_session",
      startedAt: "2026-01-03T18:00:00.000Z",
      lastActivityAt: "2026-01-03T18:00:00.000Z",
      tastings: [{ id: third.id }],
    });
    expect(result.results[1]).toMatchObject({
      type: "tasting_session",
      startedAt: "2026-01-03T12:00:00.000Z",
      lastActivityAt: "2026-01-03T14:00:00.000Z",
      tastings: [{ id: second.id }, { id: first.id }],
    });
  });

  test("fills pages with tastings when no secondary activity exists", async ({
    defaults,
    fixtures,
  }) => {
    for (let i = 0; i < 12; i++) {
      await fixtures.Tasting({
        createdById: defaults.user.id,
        createdAt: new Date(
          new Date("2026-01-01T00:00:00Z").getTime() + i * 4 * 60 * 60 * 1000,
        ),
      });
    }

    const firstPage = await routerClient.users.activity.list({
      user: defaults.user.username,
      limit: 10,
    });
    expect(firstPage.results).toHaveLength(10);
    expect(firstPage.rel.nextCursor).toEqual(expect.any(String));

    // New activity must not shift the offset inside an existing feed snapshot.
    await fixtures.Tasting({
      createdById: defaults.user.id,
      createdAt: new Date(Date.now() + 60_000),
    });

    const secondPage = await routerClient.users.activity.list({
      user: defaults.user.username,
      cursor: firstPage.rel.nextCursor!,
      limit: 10,
    });

    expect(
      firstPage.results.every((entry) => entry.type === "tasting_session"),
    ).toBe(true);
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

    await insertCollectionBottles(
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
    expect(
      entry.type === "collection_add"
        ? entry.items.every((item) => item.bottle.id > 0)
        : false,
    ).toBe(true);
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

    await insertCollectionBottles([
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

    await insertCollectionBottles([
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

    await insertCollectionBottles({
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
      await insertCollectionBottles({
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
      result.results.filter((entry) => entry.type === "tasting_session"),
    ).toHaveLength(1);
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
      await insertCollectionBottles({
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
      cursor: firstPage.rel.nextCursor!,
      limit: 3,
    });

    expect(
      firstPage.results.filter((entry) => entry.type === "tasting_session"),
    ).toHaveLength(1);
    expect(
      firstPage.results.filter((entry) => entry.type === "collection_add"),
    ).toHaveLength(2);
    expect(firstPage.rel.nextCursor).toEqual(expect.any(String));
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
    await insertCollectionBottles({
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
      cursor: firstPage.rel.nextCursor!,
      limit: 1,
    });

    expect(firstPage.results).toHaveLength(1);
    expect(firstPage.results[0].type).toBe("tasting_session");
    expect(firstPage.rel.nextCursor).toEqual(expect.any(String));
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
    await insertCollectionBottles({
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
