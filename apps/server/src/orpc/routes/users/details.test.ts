import { db } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottleTombstones,
  catalogTargets,
  collectionBottles,
  collections,
  tastings,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";
import { describe, expect, test } from "vitest";

async function targetIds(bottleId: number, groupId: number) {
  const [exact, generic] = await Promise.all([
    db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottleId),
      columns: { id: true },
    }),
    db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, groupId),
        isNull(catalogTargets.bottleId),
      ),
      columns: { id: true },
    }),
  ]);
  if (!exact || !generic) throw new Error("Missing target fixtures");
  return { exact: exact.id, generic: generic.id };
}

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
    expect(data.stats.collected).toBe(0);
  });

  test("uses authoritative exact and generic targets for profile counts", async ({
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
    const exactBottle = await fixtures.Bottle();
    const genericBottle = await fixtures.Bottle();
    const emptyBottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const retainedDriftBottle = await fixtures.Bottle();
    const targetlessBottle = await fixtures.Bottle();
    const exact = await targetIds(exactBottle.id, exactBottle.groupId!);
    const generic = await targetIds(genericBottle.id, genericBottle.groupId!);
    const empty = await targetIds(emptyBottle.id, emptyBottle.groupId!);
    const other = await targetIds(otherBottle.id, otherBottle.groupId!);

    const exactTasting = await fixtures.Tasting({
      bottleId: retainedDriftBottle.id,
      targetId: exact.exact,
      createdById: defaults.user.id,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await Promise.all([
      fixtures.Tasting({
        bottleId: exactBottle.id,
        targetId: exact.exact,
        createdById: defaults.user.id,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
      fixtures.Tasting({
        bottleId: genericBottle.id,
        targetId: generic.generic,
        createdById: defaults.user.id,
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
      }),
    ]);
    const targetlessTasting = await fixtures.Tasting({
      bottleId: targetlessBottle.id,
      targetId: null,
      createdById: defaults.user.id,
      createdAt: new Date("2026-01-04T00:00:00.000Z"),
    });
    await db.insert(collectionBottles).values([
      {
        collectionId: library.id,
        bottleId: exactBottle.id,
        targetId: exact.exact,
        status: "open",
      },
      {
        collectionId: library.id,
        bottleId: genericBottle.id,
        targetId: generic.generic,
        status: "sealed",
      },
      {
        collectionId: library.id,
        bottleId: emptyBottle.id,
        targetId: empty.exact,
        status: "empty",
      },
    ]);
    const [targetlessEntry] = await db
      .insert(collectionBottles)
      .values({
        collectionId: library.id,
        bottleId: targetlessBottle.id,
        targetId: null,
        status: null,
      })
      .returning();
    if (!targetlessEntry) throw new Error("Missing targetless entry fixture");
    const [driftEntry] = await db
      .insert(collectionBottles)
      .values({
        collectionId: otherCollection.id,
        bottleId: retainedDriftBottle.id,
        targetId: other.exact,
        status: "open",
      })
      .returning();
    if (!driftEntry) throw new Error("Missing collection entry fixture");
    await db.insert(collectionBottles).values({
      collectionId: otherCollection.id,
      bottleId: exactBottle.id,
      targetId: exact.exact,
      status: "empty",
    });

    const data = await routerClient.users.details(
      { user: defaults.user.id },
      { context: { user: defaults.user } },
    );

    expect(data.stats).toMatchObject({
      tastings: 4,
      bottles: 2,
      collected: 4,
      library: { total: 3, open: 1, sealed: 1 },
    });

    const [
      persistedDriftTasting,
      persistedTargetlessTasting,
      persistedDriftEntry,
      persistedTargetlessEntry,
    ] = await Promise.all([
      db.query.tastings.findFirst({
        where: eq(tastings.id, exactTasting.id),
        columns: { bottleId: true, releaseId: true, targetId: true },
      }),
      db.query.tastings.findFirst({
        where: eq(tastings.id, targetlessTasting.id),
        columns: { bottleId: true, releaseId: true, targetId: true },
      }),
      db.query.collectionBottles.findFirst({
        where: eq(collectionBottles.id, driftEntry.id),
        columns: { bottleId: true, releaseId: true, targetId: true },
      }),
      db.query.collectionBottles.findFirst({
        where: eq(collectionBottles.id, targetlessEntry.id),
        columns: { bottleId: true, releaseId: true, targetId: true },
      }),
    ]);
    expect(persistedDriftTasting).toEqual({
      bottleId: retainedDriftBottle.id,
      releaseId: null,
      targetId: exact.exact,
    });
    expect(persistedTargetlessTasting).toEqual({
      bottleId: targetlessBottle.id,
      releaseId: null,
      targetId: null,
    });
    expect(persistedDriftEntry).toEqual({
      bottleId: retainedDriftBottle.id,
      releaseId: null,
      targetId: other.exact,
    });
    expect(persistedTargetlessEntry).toEqual({
      bottleId: targetlessBottle.id,
      releaseId: null,
      targetId: null,
    });
  });

  test("scans tasting and collection targets across batch boundaries", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const { exact } = await targetIds(bottle.id, bottle.groupId!);
    await db.insert(tastings).values(
      Array.from({ length: 201 }, (_, index) => ({
        bottleId: bottle.id,
        targetId: exact,
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
        targetId: exact,
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

  test("fails closed when a tasting target is retired", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const { exact } = await targetIds(bottle.id, bottle.groupId!);
    await fixtures.Tasting({
      bottleId: bottle.id,
      targetId: exact,
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

  test("fails closed when a collection target group is retired", async ({
    defaults,
    fixtures,
  }) => {
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
    });
    const bottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const { generic } = await targetIds(bottle.id, bottle.groupId!);
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: bottle.id,
      targetId: generic,
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
