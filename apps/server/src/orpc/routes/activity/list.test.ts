import { db } from "@peated/server/db";
import { collectionBottles, memberReviews } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { sql } from "drizzle-orm";
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

describe("GET /activity", () => {
  for (const feed of ["global", "profile"] as const) {
    test(`includes microsecond-precision additions in ${feed} feed previews`, async ({
      fixtures,
    }) => {
      const user = await fixtures.User();
      const collection = await fixtures.Collection({
        name: "Library",
        createdById: user.id,
      });
      const addedBottles = await Promise.all(
        Array.from({ length: 6 }, () => fixtures.Bottle()),
      );
      await db.insert(collectionBottles).values(
        addedBottles.map((bottle, index) => ({
          collectionId: collection.id,
          bottleId: bottle.id,
          createdAt:
            index === 0
              ? sql`TIMESTAMP '2026-01-04 12:00:00.123456'`
              : sql`TIMESTAMP '2026-01-03 12:00:00.123000' + ${index} * INTERVAL '1 microsecond'`,
        })),
      );

      const result =
        feed === "global"
          ? await routerClient.activity.list({ filter: "global", limit: 10 })
          : await routerClient.users.activity.list({
              user: user.username,
              limit: 10,
            });

      expect(result.results).toMatchObject([
        {
          type: "collection_add",
          totalItems: 1,
          createdAt: "2026-01-04T12:00:00.123Z",
          items: [{ bottle: { id: addedBottles[0].id } }],
        },
        {
          type: "collection_add",
          totalItems: 5,
          createdAt: "2026-01-03T12:00:00.123Z",
          items: [5, 4, 3, 2].map((index) => ({
            bottle: { id: addedBottles[index].id },
          })),
        },
      ]);
    });
  }

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
    const [firstBottle, secondBottle, thirdBottle] = await Promise.all([
      fixtures.Bottle(),
      fixtures.Bottle(),
      fixtures.Bottle({ name: "Activity preview" }),
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
        createdAt: new Date("2026-01-03T12:10:00Z"),
      },
      {
        collectionId: collection.id,
        bottleId: thirdBottle.id,
        createdAt: new Date("2026-01-03T12:20:00Z"),
      },
    ]);

    const result = await routerClient.activity.list({
      filter: "global",
      limit: 10,
    });

    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({
      id: `tasting_session:${user.id}:${tasting.id}`,
      type: "tasting_session",
      priority: "primary",
      startedAt: "2026-01-03T12:30:00.000Z",
      lastActivityAt: "2026-01-03T12:30:00.000Z",
      createdBy: {
        id: user.id,
      },
      tastings: [
        {
          id: tasting.id,
          bottle: {
            id: tasting.bottleId,
          },
        },
      ],
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
    expect(collectionItems.map((item) => item.bottle.id)).toEqual(
      expect.arrayContaining([firstBottle.id, secondBottle.id, thirdBottle.id]),
    );
    expect(collectionItems.every((item) => item.bottle.group?.fullName)).toBe(
      true,
    );
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
    await insertCollectionBottles({
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
      type: "tasting_session",
      tastings: [{ id: visibleTasting.id }],
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
    await insertCollectionBottles({
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
      "tasting_session",
      "collection_add",
    ]);
    expect(result.results[0]).toMatchObject({
      type: "tasting_session",
      tastings: [{ id: tasting.id }],
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
    await insertCollectionBottles([
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
      type: "tasting_session",
      tastings: [{ id: friendTasting.id }],
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
    await insertCollectionBottles(
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
      await insertCollectionBottles({
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
      result.results.filter((entry) => entry.type === "tasting_session"),
    ).toHaveLength(1);
    expect(
      result.results.filter((entry) => entry.type === "collection_add"),
    ).toHaveLength(2);
  });

  test("groups each user's nearby tastings despite interleaved activity", async ({
    fixtures,
  }) => {
    const [firstUser, secondUser] = await Promise.all([
      fixtures.User(),
      fixtures.User(),
    ]);
    const first = await fixtures.Tasting({
      createdById: firstUser.id,
      createdAt: new Date("2026-01-03T12:00:00Z"),
    });
    const interleaved = await fixtures.Tasting({
      createdById: secondUser.id,
      createdAt: new Date("2026-01-03T12:30:00Z"),
    });
    const latest = await fixtures.Tasting({
      createdById: firstUser.id,
      createdAt: new Date("2026-01-03T13:00:00Z"),
    });

    const result = await routerClient.activity.list({
      filter: "global",
      limit: 10,
    });

    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toMatchObject({
      type: "tasting_session",
      createdBy: { id: firstUser.id },
      startedAt: "2026-01-03T12:00:00.000Z",
      lastActivityAt: "2026-01-03T13:00:00.000Z",
      tastings: [{ id: latest.id }, { id: first.id }],
    });
    expect(result.results[1]).toMatchObject({
      type: "tasting_session",
      createdBy: { id: secondUser.id },
      tastings: [{ id: interleaved.id }],
    });
  });
});

test("member reviews respect public and accepted-follow visibility", async ({
  fixtures,
  defaults,
}) => {
  const publicUser = await fixtures.User();
  const friend = await fixtures.User({ private: true });
  const pending = await fixtures.User({ private: true });
  await fixtures.Follow({
    fromUserId: defaults.user.id,
    toUserId: friend.id,
    status: "following",
  });
  await fixtures.Follow({
    fromUserId: defaults.user.id,
    toUserId: pending.id,
    status: "pending",
  });
  const bottle = await fixtures.Bottle();
  await db.insert(memberReviews).values(
    [publicUser, friend, pending].map((user) => ({
      bottleId: bottle.id,
      createdById: user.id,
      score: 90,
      createdAt: new Date("2026-01-03T12:00:00Z"),
    })),
  );
  const publicFeed = await routerClient.activity.list({ filter: "global" });
  expect(publicFeed.results.map((item) => item.createdBy.id)).toEqual([
    publicUser.id,
  ]);
  const friendFeed = await routerClient.activity.list(
    { filter: "friends" },
    { context: { user: defaults.user } },
  );
  expect(friendFeed.results.map((item) => item.createdBy.id)).toEqual([
    friend.id,
  ]);
  const signedIn = await routerClient.activity.list(
    { filter: "global" },
    { context: { user: defaults.user } },
  );
  expect(
    signedIn.results.map((item) => item.createdBy.id).sort((a, b) => a - b),
  ).toEqual([friend.id, publicUser.id].sort((a, b) => a - b));
  const profile = await routerClient.users.activity.list(
    { user: friend.username },
    { context: { user: defaults.user } },
  );
  expect(profile.results).toMatchObject([
    {
      type: "member_review",
      review: {
        score: 90,
        bottle: { id: bottle.id },
        createdBy: { id: friend.id },
      },
    },
  ]);
});

test("pages member reviews and tasting sessions together without duplicates", async ({
  fixtures,
}) => {
  const user = await fixtures.User();
  const bottle = await fixtures.Bottle();
  const early = await fixtures.Tasting({
    createdById: user.id,
    createdAt: new Date("2026-01-03T12:00:00Z"),
  });
  const latest = await fixtures.Tasting({
    createdById: user.id,
    createdAt: new Date("2026-01-03T13:00:00Z"),
  });
  const [review] = await db
    .insert(memberReviews)
    .values({
      bottleId: bottle.id,
      createdById: user.id,
      score: 0,
      notes: "Review notes",
      createdAt: new Date("2026-01-03T14:00:00Z"),
    })
    .returning();
  const first = await routerClient.activity.list({ limit: 1 });
  expect(first.results).toMatchObject([
    {
      id: `member_review:${review.id}`,
      type: "member_review",
      review: { score: 0, notes: "Review notes", bottle: { id: bottle.id } },
    },
  ]);
  expect(first.rel.nextCursor).not.toBeNull();
  const second = await routerClient.activity.list({
    limit: 1,
    cursor: first.rel.nextCursor!,
  });
  expect(second.results).toMatchObject([
    {
      type: "tasting_session",
      tastings: [{ id: latest.id }, { id: early.id }],
    },
  ]);
  expect(second.rel.nextCursor).toBeNull();
  const previous = await routerClient.activity.list({
    limit: 1,
    cursor: second.rel.prevCursor!,
  });
  expect(previous.results).toEqual(first.results);
});
