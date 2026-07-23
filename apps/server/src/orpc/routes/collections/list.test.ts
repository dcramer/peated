import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleReleasePromotions,
  bottleTombstones,
  bottles,
  catalogTargets,
  collectionBottles,
  type Bottle,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";
import { describe, expect, test } from "vitest";

async function exactTargetId(bottleId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
    columns: { id: true },
  });
  if (!target) throw new Error("Missing exact CatalogTarget fixture");
  return target.id;
}

async function genericTargetId(groupId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: and(
      eq(catalogTargets.groupId, groupId),
      isNull(catalogTargets.bottleId),
    ),
    columns: { id: true },
  });
  if (!target) throw new Error("Missing generic CatalogTarget fixture");
  return target.id;
}

async function promoteRelease(parent: Bottle, releaseId: number) {
  if (parent.groupId === null) {
    throw new Error("Missing parent BottleGroup fixture");
  }
  const [promoted] = await db
    .insert(bottles)
    .values({
      groupId: parent.groupId,
      brandId: parent.brandId,
      name: `${parent.name} promoted`,
      fullName: `${parent.fullName} promoted`,
      createdByActorId: parent.createdByActorId,
    })
    .returning();
  if (!promoted) throw new Error("Missing promoted Bottle fixture");
  const [target] = await db
    .insert(catalogTargets)
    .values({ groupId: parent.groupId, bottleId: promoted.id })
    .returning();
  if (!target) throw new Error("Missing promoted CatalogTarget fixture");
  await db.insert(bottleReleasePromotions).values({
    releaseId,
    promotedBottleId: promoted.id,
    status: "promoted",
    completedAt: new Date(),
    createdByActorId: parent.createdByActorId,
  });
  return { promoted, target };
}

describe("GET /users/:user/collections", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.collections.list({ user: "me" }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("cannot list private without friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: true });

    const err = await waitError(() =>
      routerClient.collections.list(
        {
          user: otherUser.id,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: User's profile is private.]`);
  });

  test("can list private with friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: true });
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: otherUser.id,
      status: "following",
    });

    const { results } = await routerClient.collections.list(
      {
        user: otherUser.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toEqual(0);
  });

  test("can list public without friend", async ({ defaults, fixtures }) => {
    const otherUser = await fixtures.User({ private: false });

    const { results } = await routerClient.collections.list(
      {
        user: otherUser.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toEqual(0);
  });

  test("only returns collections for requested user", async ({
    defaults,
    fixtures,
  }) => {
    const otherUser = await fixtures.User({ private: false });

    // Create a collection for the requested user
    const userCollection = await fixtures.Collection({
      name: "User Collection",
      createdById: otherUser.id,
    });

    // Create a collection for a different user
    const otherUserCollection = await fixtures.Collection({
      name: "Other User Collection",
      createdById: defaults.user.id,
    });

    const { results } = await routerClient.collections.list(
      {
        user: otherUser.id,
      },
      { context: { user: defaults.user } },
    );

    expect(results.length).toEqual(1);
    expect(results[0].id).toEqual(userCollection.id);
    expect(results[0].name).toEqual("User Collection");
    expect(results.some((c) => c.id === otherUserCollection.id)).toBe(false);
  });

  test("filters collection membership through the Bottle exact target", async ({
    defaults,
    fixtures,
  }) => {
    const selected = await fixtures.Bottle();
    const other = await fixtures.Bottle();
    const matching = await fixtures.Collection({
      name: "Matching",
      createdById: defaults.user.id,
    });
    const nonmatching = await fixtures.Collection({
      name: "Nonmatching",
      createdById: defaults.user.id,
    });
    await db.insert(collectionBottles).values([
      {
        collectionId: matching.id,
        bottleId: selected.id,
        targetId: await exactTargetId(selected.id),
      },
      {
        collectionId: nonmatching.id,
        bottleId: other.id,
        targetId: await exactTargetId(other.id),
      },
    ]);

    const { results } = await routerClient.collections.list(
      { user: "me", bottle: selected.id },
      { context: { user: defaults.user } },
    );

    expect(results.map(({ id }) => id)).toEqual([matching.id]);
  });

  test("does not treat a generic group target as Bottle membership", async ({
    defaults,
    fixtures,
  }) => {
    const selected = await fixtures.Bottle();
    if (selected.groupId === null) {
      throw new Error("Missing BottleGroup fixture");
    }
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
    });
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: null,
      targetId: await genericTargetId(selected.groupId),
    });

    const { results } = await routerClient.collections.list(
      { user: "me", bottle: selected.id },
      { context: { user: defaults.user } },
    );

    expect(results).toEqual([]);
  });

  test("excludes retained-only membership without a durable target", async ({
    defaults,
    fixtures,
  }) => {
    const selected = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
    });
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: selected.id,
      targetId: null,
    });

    const { results } = await routerClient.collections.list(
      { user: "me", bottle: selected.id },
      { context: { user: defaults.user } },
    );

    expect(results).toEqual([]);
  });

  test("uses target authority when retained Bottle identity drifts", async ({
    defaults,
    fixtures,
  }) => {
    const selected = await fixtures.Bottle();
    const retained = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
    });
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: retained.id,
      targetId: await exactTargetId(selected.id),
    });

    const { results } = await routerClient.collections.list(
      { user: "me", bottle: selected.id },
      { context: { user: defaults.user } },
    );

    expect(results.map(({ id }) => id)).toEqual([collection.id]);
  });

  test("resolves promoted retained membership semantically for parity only", async ({
    defaults,
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const { promoted, target } = await promoteRelease(parent, release.id);
    const authoritative = await fixtures.Collection({
      name: "Authoritative promoted",
      createdById: defaults.user.id,
    });
    const retainedOnly = await fixtures.Collection({
      name: "Retained-only promoted",
      createdById: defaults.user.id,
    });
    await db.insert(collectionBottles).values([
      {
        collectionId: authoritative.id,
        bottleId: parent.id,
        releaseId: release.id,
        targetId: target.id,
      },
      {
        collectionId: retainedOnly.id,
        bottleId: parent.id,
        releaseId: release.id,
        targetId: null,
      },
    ]);

    const { results } = await routerClient.collections.list(
      { user: "me", bottle: promoted.id },
      { context: { user: defaults.user } },
    );

    expect(results.map(({ id }) => id)).toEqual([authoritative.id]);
  });

  test("fails closed when the selected Bottle has no exact target", async ({
    defaults,
    fixtures,
  }) => {
    const selected = await fixtures.Bottle();
    await db
      .update(bottleAliases)
      .set({ targetId: null })
      .where(eq(bottleAliases.bottleId, selected.id));
    await db
      .delete(catalogTargets)
      .where(eq(catalogTargets.bottleId, selected.id));

    const err = await waitError(() =>
      routerClient.collections.list(
        { user: "me", bottle: selected.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchObject({
      message: `Catalog target not found (bottleId=${selected.id}).`,
    });
  });

  test("fails closed when the selected Bottle target is retired", async ({
    defaults,
    fixtures,
  }) => {
    const selected = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: selected.id,
      newBottleId: replacement.id,
    });

    const err = await waitError(() =>
      routerClient.collections.list(
        { user: "me", bottle: selected.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchObject({
      message: `Catalog target is retired (bottleId=${selected.id}).`,
    });
  });

  test("fails closed on an invalid durable target in parity candidates", async ({
    defaults,
    fixtures,
  }) => {
    const selected = await fixtures.Bottle();
    const invalidTargetBottle = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
    });
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: selected.id,
      targetId: await exactTargetId(invalidTargetBottle.id),
    });
    await db.insert(bottleTombstones).values({
      bottleId: invalidTargetBottle.id,
      newBottleId: replacement.id,
    });

    const err = await waitError(() =>
      routerClient.collections.list(
        { user: "me", bottle: selected.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchObject({
      message: `Catalog target is retired (bottleId=${invalidTargetBottle.id}).`,
    });
  });

  test("preserves filtered pagination and deterministic name ordering", async ({
    defaults,
    fixtures,
  }) => {
    const selected = await fixtures.Bottle();
    const targetId = await exactTargetId(selected.id);
    const first = await fixtures.Collection({
      name: "Alpha",
      createdById: defaults.user.id,
    });
    const second = await fixtures.Collection({
      name: "Beta",
      createdById: defaults.user.id,
    });
    const excluded = await fixtures.Collection({
      name: "Aardvark excluded",
      createdById: defaults.user.id,
    });
    const other = await fixtures.Bottle();
    await db.insert(collectionBottles).values([
      {
        collectionId: first.id,
        bottleId: selected.id,
        targetId,
      },
      {
        collectionId: second.id,
        bottleId: selected.id,
        targetId,
      },
      {
        collectionId: excluded.id,
        bottleId: other.id,
        targetId: await exactTargetId(other.id),
      },
    ]);

    const pageOne = await routerClient.collections.list(
      { user: "me", bottle: selected.id, limit: 1 },
      { context: { user: defaults.user } },
    );
    const pageTwo = await routerClient.collections.list(
      { user: "me", bottle: selected.id, limit: 1, cursor: 2 },
      { context: { user: defaults.user } },
    );

    expect(pageOne.results.map(({ id }) => id)).toEqual([first.id]);
    expect(pageOne.rel).toEqual({ nextCursor: 2, prevCursor: null });
    expect(pageTwo.results.map(({ id }) => id)).toEqual([second.id]);
    expect(pageTwo.rel).toEqual({ nextCursor: null, prevCursor: 1 });
  });
});
