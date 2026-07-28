import { db } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottleTombstones,
  collectionBottles,
  collections,
  tastings,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("GET /users/:user", () => {
  test("get user by id", async ({ defaults, fixtures }) => {
    const user = await fixtures.User();

    const data = await routerClient.users.details(
      { user: user.id },
      { context: { user: defaults.user } },
    );
    expect(data.id).toEqual(user.id);
    expect(data.friendStatus).toBe("none");
  });

  test("returns zero Library stats without collection entries", async ({
    defaults,
    fixtures,
  }) => {
    const user = await fixtures.User();

    const data = await routerClient.users.details(
      { user: user.id },
      { context: { user: defaults.user } },
    );

    expect(data.stats.library).toEqual({
      total: 0,
      open: 0,
      sealed: 0,
    });
  });

  test("get user:me", async ({ defaults }) => {
    const data = await routerClient.users.details(
      { user: "me" },
      { context: { user: defaults.user } },
    );
    expect(data.id).toBe(defaults.user.id);
  });

  test("requires authentication for user:me", async () => {
    const error = await waitError(routerClient.users.details({ user: "me" }));

    expect(error).toMatchObject({ status: 401 });
  });

  test("get user by username", async ({ defaults }) => {
    const data = await routerClient.users.details(
      { user: defaults.user.username },
      { context: { user: defaults.user } },
    );
    expect(data.id).toBe(defaults.user.id);
  });

  test("get user w/ friendStatus", async ({ defaults, fixtures }) => {
    const user = await fixtures.User();
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: user.id,
    });

    const data = await routerClient.users.details(
      { user: user.id },
      { context: { user: defaults.user } },
    );
    expect(data.id).toBe(user.id);
    expect(data.friendStatus).toBe("friends");
  });

  test("counts actor-backed catalog contributions", async ({
    defaults,
    fixtures,
  }) => {
    const targetActor = await getUserActor(defaults.user);
    const otherUser = await fixtures.User();
    const otherActor = await getUserActor(otherUser);

    await fixtures.Entity({
      name: "Target Contribution",
      createdByActorId: targetActor.id,
    });
    await fixtures.Entity({
      name: "Other Contribution",
      createdByActorId: otherActor.id,
    });

    const data = await routerClient.users.details(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data.stats.contributions).toBe(1);
  });

  test("counts non-empty Library bottles by status", async ({
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
    const [openBottle, sealedBottle, emptyBottle, unsetBottle, otherBottle] =
      await Promise.all([
        fixtures.Bottle(),
        fixtures.Bottle(),
        fixtures.Bottle(),
        fixtures.Bottle(),
        fixtures.Bottle(),
      ]);

    await db.insert(collectionBottles).values([
      {
        collectionId: library.id,
        bottleId: openBottle.id,
        status: "open",
      },
      {
        collectionId: library.id,
        bottleId: sealedBottle.id,
        status: "sealed",
      },
      {
        collectionId: library.id,
        bottleId: emptyBottle.id,
        status: "empty",
      },
      {
        collectionId: library.id,
        bottleId: unsetBottle.id,
        status: null,
      },
      {
        collectionId: otherCollection.id,
        bottleId: otherBottle.id,
        status: "open",
      },
    ]);

    const data = await routerClient.users.details(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data.stats.library).toEqual({
      total: 3,
      open: 1,
      sealed: 1,
    });
    expect(data.stats.collected).toBe(5);
  });

  test("counts and deduplicates direct Bottle references", async ({
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
    const firstBottle = await fixtures.Bottle();
    if (firstBottle.groupId === null) {
      throw new Error("Missing BottleGroup fixture");
    }
    const secondBottle = await fixtures.BottleGroupMember({
      groupId: firstBottle.groupId,
      edition: "Distinct profile member",
    });
    const emptyBottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    await fixtures.Tasting({
      bottleId: firstBottle.id,
      createdById: defaults.user.id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await Promise.all([
      fixtures.Tasting({
        bottleId: firstBottle.id,
        createdById: defaults.user.id,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
      fixtures.Tasting({
        bottleId: secondBottle.id,
        createdById: defaults.user.id,
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
      }),
    ]);
    await db.insert(collectionBottles).values([
      {
        collectionId: library.id,
        bottleId: firstBottle.id,
        status: "open",
      },
      {
        collectionId: library.id,
        bottleId: secondBottle.id,
        status: "sealed",
      },
      {
        collectionId: library.id,
        bottleId: emptyBottle.id,
        status: "empty",
      },
      {
        collectionId: otherCollection.id,
        bottleId: otherBottle.id,
        status: "open",
      },
      {
        collectionId: otherCollection.id,
        bottleId: firstBottle.id,
        status: "empty",
      },
    ]);

    const data = await routerClient.users.details(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data.stats).toMatchObject({
      tastings: 3,
      bottles: 2,
      collected: 4,
      library: { total: 3, open: 1, sealed: 1 },
    });
  });

  test("scans tasting and collection Bottles across batch boundaries", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await db.insert(tastings).values(
      Array.from({ length: 201 }, (_, index) => ({
        bottleId: bottle.id,
        createdById: defaults.user.id,
        createdAt: new Date(Date.UTC(2025, 0, 1, 0, 0, index)),
      })),
    );
    const batchCollections = await db
      .insert(collections)
      .values(
        Array.from({ length: 201 }, (_, index) => ({
          name: `Batch Collection ${index}`,
          createdById: defaults.user.id,
        })),
      )
      .returning({ id: collections.id });
    await db.insert(collectionBottles).values(
      batchCollections.map((collection) => ({
        collectionId: collection.id,
        bottleId: bottle.id,
        status: "empty" as const,
      })),
    );

    const data = await routerClient.users.details(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data.stats).toMatchObject({
      tastings: 201,
      bottles: 1,
      collected: 1,
      library: { total: 0, open: 0, sealed: 0 },
    });
  });

  test("fails closed when a tasting Bottle is retired", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: defaults.user.id,
    });
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: replacement.id,
    });

    const error = await waitError(
      routerClient.users.details(
        { user: defaults.user.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({ status: 409 });
  });

  test("fails closed when a collection BottleGroup is retired", async ({
    defaults,
    fixtures,
  }) => {
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
    });
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: bottle.id,
      status: "sealed",
    });
    await db.insert(bottleGroupTombstones).values({
      groupId: bottle.groupId!,
      newGroupId: replacement.groupId!,
      createdByActorId: bottle.createdByActorId,
    });

    const error = await waitError(
      routerClient.users.details(
        { user: defaults.user.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({ status: 409 });
  });

  test("preserves private profile detail visibility", async ({
    defaults,
    fixtures,
  }) => {
    const user = await fixtures.User({ private: true });

    const data = await routerClient.users.details(
      { user: user.id },
      { context: { user: defaults.user } },
    );

    expect(data).toMatchObject({ id: user.id, private: true });
  });

  test("errors on invalid username", async () => {
    const err = await waitError(() =>
      routerClient.users.details({ user: "notauser" }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: User not found]`);
  });
});
