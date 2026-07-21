import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

async function insertTargetBackedCollectionBottles(
  values:
    | typeof collectionBottles.$inferInsert
    | (typeof collectionBottles.$inferInsert)[],
) {
  const valueList = Array.isArray(values) ? values : [values];
  await db.insert(collectionBottles).values(
    await Promise.all(
      valueList.map(async (value) => {
        if (value.targetId !== undefined) return value;
        const target = await db.query.catalogTargets.findFirst({
          where: (catalogTargets, { eq }) =>
            eq(catalogTargets.bottleId, value.bottleId),
          columns: { id: true },
        });
        if (!target) throw new Error("Exact target fixture missing");
        return { ...value, targetId: target.id };
      }),
    ),
  );
}

describe("GET /activity", () => {
  test("returns tastings and grouped collection additions", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    const tasting = await fixtures.Tasting({
      createdById: user.id,
      createdAt: new Date("2026-01-03T12:30:00Z"),
    });
    const collection = await fixtures.Collection({
      name: "Library",
      createdById: user.id,
    });
    const [firstBottle, secondBottle, genericBottle] = await Promise.all([
      fixtures.Bottle(),
      fixtures.Bottle(),
      fixtures.Bottle({ name: "Generic activity preview" }),
    ]);
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { and, eq, isNull }) =>
        and(
          eq(catalogTargets.groupId, genericBottle.groupId as number),
          isNull(catalogTargets.bottleId),
        ),
    });
    if (!genericTarget) throw new Error("Generic target fixture missing");
    await insertTargetBackedCollectionBottles([
      {
        collectionId: collection.id,
        bottleId: firstBottle.id,
        createdAt: new Date("2026-01-03T12:00:00Z"),
      },
      {
        collectionId: collection.id,
        bottleId: secondBottle.id,
        createdAt: new Date("2026-01-03T12:10:00Z"),
      },
      {
        collectionId: collection.id,
        bottleId: genericBottle.id,
        targetId: genericTarget.id,
        createdAt: new Date("2026-01-03T12:20:00Z"),
      },
    ]);

    const result = await routerClient.activity.list({
      filter: "global",
      limit: 10,
    });

    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({
      id: `tasting:${tasting.id}`,
      type: "tasting",
      priority: "primary",
      tasting: {
        id: tasting.id,
      },
    });
    expect(result.results[1]).toMatchObject({
      type: "collection_add",
      priority: "secondary",
      createdBy: {
        id: user.id,
      },
      collection: {
        id: collection.id,
        href: `/users/${user.username}/library`,
      },
      totalItems: 3,
    });
    const collectionItems =
      result.results[1].type === "collection_add"
        ? result.results[1].items
        : [];
    expect(
      collectionItems.filter((item) => item.target.kind === "bottle"),
    ).toHaveLength(2);
    const genericItem = collectionItems.find(
      (item) => item.target.kind === "group",
    );
    expect(genericItem?.target).toMatchObject({
      kind: "group",
      targetId: genericTarget.id,
      group: { id: genericBottle.groupId },
    });
    expect(genericItem?.target).not.toHaveProperty("bottle");
  });

  test("hides private users from anonymous global activity", async ({
    fixtures,
  }) => {
    const publicUser = await fixtures.User();
    const privateUser = await fixtures.User({ private: true });
    const visibleTasting = await fixtures.Tasting({
      createdById: publicUser.id,
      createdAt: new Date("2026-01-03T12:30:00Z"),
    });
    await fixtures.Tasting({
      createdById: privateUser.id,
      createdAt: new Date("2026-01-03T12:40:00Z"),
    });
    const privateCollection = await fixtures.Collection({
      name: "Library",
      createdById: privateUser.id,
    });
    await insertTargetBackedCollectionBottles({
      collectionId: privateCollection.id,
      bottleId: (await fixtures.Bottle()).id,
      createdAt: new Date("2026-01-03T12:45:00Z"),
    });

    const result = await routerClient.activity.list({
      filter: "global",
      limit: 10,
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      type: "tasting",
      tasting: {
        id: visibleTasting.id,
      },
    });
  });

  test("shows followed private users in authenticated global activity", async ({
    defaults,
    fixtures,
  }) => {
    const friend = await fixtures.User({ private: true });
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: friend.id,
      status: "following",
    });
    const tasting = await fixtures.Tasting({
      createdById: friend.id,
      createdAt: new Date("2026-01-03T12:30:00Z"),
    });
    const collection = await fixtures.Collection({
      name: "Library",
      createdById: friend.id,
    });
    await insertTargetBackedCollectionBottles({
      collectionId: collection.id,
      bottleId: (await fixtures.Bottle()).id,
      createdAt: new Date("2026-01-03T12:00:00Z"),
    });

    const result = await routerClient.activity.list(
      {
        filter: "global",
        limit: 10,
      },
      { context: { user: defaults.user } },
    );

    expect(result.results.map((entry) => entry.type)).toEqual([
      "tasting",
      "collection_add",
    ]);
    expect(result.results[0]).toMatchObject({
      type: "tasting",
      tasting: {
        id: tasting.id,
      },
    });
    expect(result.results[1]).toMatchObject({
      type: "collection_add",
      createdBy: {
        id: friend.id,
      },
    });
  });

  test("requires authentication for friends activity", async () => {
    const err = await waitError(() =>
      routerClient.activity.list({
        filter: "friends",
      }),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("friends activity includes followed users only", async ({
    defaults,
    fixtures,
  }) => {
    const friend = await fixtures.User();
    const stranger = await fixtures.User();
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: friend.id,
      status: "following",
    });
    const friendTasting = await fixtures.Tasting({
      createdById: friend.id,
      createdAt: new Date("2026-01-03T12:30:00Z"),
    });
    await fixtures.Tasting({
      createdById: stranger.id,
      createdAt: new Date("2026-01-03T12:40:00Z"),
    });
    const friendCollection = await fixtures.Collection({
      name: "Library",
      createdById: friend.id,
    });
    const strangerCollection = await fixtures.Collection({
      name: "Library",
      createdById: stranger.id,
    });
    await insertTargetBackedCollectionBottles([
      {
        collectionId: friendCollection.id,
        bottleId: (await fixtures.Bottle()).id,
        createdAt: new Date("2026-01-03T12:00:00Z"),
      },
      {
        collectionId: strangerCollection.id,
        bottleId: (await fixtures.Bottle()).id,
        createdAt: new Date("2026-01-03T12:10:00Z"),
      },
    ]);

    const result = await routerClient.activity.list(
      {
        filter: "friends",
        limit: 10,
      },
      { context: { user: defaults.user } },
    );

    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({
      type: "tasting",
      tasting: {
        id: friendTasting.id,
      },
    });
    expect(result.results[1]).toMatchObject({
      type: "collection_add",
      createdBy: {
        id: friend.id,
      },
    });
  });

  test("groups collection-only activity", async ({ fixtures }) => {
    const user = await fixtures.User();
    const collection = await fixtures.Collection({
      name: "Library",
      createdById: user.id,
    });
    const bottles = await Promise.all([
      fixtures.Bottle(),
      fixtures.Bottle(),
      fixtures.Bottle(),
    ]);
    await insertTargetBackedCollectionBottles(
      bottles.map((bottle, index) => ({
        collectionId: collection.id,
        bottleId: bottle.id,
        createdAt: new Date(`2026-01-03T1${index}:00:00Z`),
      })),
    );

    const result = await routerClient.activity.list({
      filter: "global",
      limit: 10,
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0]).toMatchObject({
      type: "collection_add",
      totalItems: 3,
    });
    expect(
      result.results[0].type === "collection_add"
        ? result.results[0].items
        : [],
    ).toHaveLength(3);
  });

  test("caps secondary entries when tasting activity exists", async ({
    fixtures,
  }) => {
    const user = await fixtures.User();
    await fixtures.Tasting({
      createdById: user.id,
      createdAt: new Date("2026-01-03T12:30:00Z"),
    });

    for (let i = 0; i < 4; i++) {
      const collection = await fixtures.Collection({
        name: `Shelf ${i}`,
        createdById: user.id,
      });
      await insertTargetBackedCollectionBottles({
        collectionId: collection.id,
        bottleId: (await fixtures.Bottle()).id,
        createdAt: new Date(`2026-01-03T1${i}:00:00Z`),
      });
    }

    const result = await routerClient.activity.list({
      filter: "global",
      limit: 10,
    });

    expect(
      result.results.filter((entry) => entry.type === "tasting"),
    ).toHaveLength(1);
    expect(
      result.results.filter((entry) => entry.type === "collection_add"),
    ).toHaveLength(2);
  });
});
