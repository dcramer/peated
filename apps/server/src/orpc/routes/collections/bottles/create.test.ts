import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import {
  type Bottle,
  bottleReleasePromotions,
  bottleReleases,
  bottles,
  catalogTargets,
  collectionBottles,
  collections,
  pendingUploads,
} from "@peated/server/db/schema";
import { getDefaultCollection } from "@peated/server/lib/db";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import waitError from "@peated/server/lib/test/waitError";
import { compressAndResizeImage } from "@peated/server/lib/uploads";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";
import pg from "pg";
import { describe, expect, test, vi } from "vitest";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

async function waitForSessionsBlockedBy(
  client: NodePgClient,
  blockerPid: number,
  expectedCount: number,
): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM pg_stat_activity
       WHERE $1 = ANY(pg_blocking_pids(pid))`,
      [blockerPid],
    );
    if ((result.rows[0]?.count ?? 0) >= expectedCount) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for collection membership locks.");
}

async function promoteRelease(releaseId: number, parent: Bottle) {
  const [promotedBottle] = await db
    .insert(bottles)
    .values({
      groupId: parent.groupId,
      brandId: parent.brandId,
      createdByActorId: parent.createdByActorId,
      name: `${parent.name} promoted ${releaseId}`,
      fullName: `${parent.fullName} promoted ${releaseId}`,
    })
    .returning();
  if (!promotedBottle || parent.groupId === null) {
    throw new Error("Unable to create promoted Bottle fixture");
  }
  const [target] = await db
    .insert(catalogTargets)
    .values({
      groupId: parent.groupId,
      bottleId: promotedBottle.id,
    })
    .returning();
  if (!target) {
    throw new Error("Unable to create promoted Bottle target fixture");
  }
  await db.insert(bottleReleasePromotions).values({
    releaseId,
    promotedBottleId: promotedBottle.id,
    status: "promoted",
    completedAt: new Date(),
    createdByActorId: parent.createdByActorId,
  });
  return { promotedBottle, target };
}

describe("POST /users/:user/collections/:collection/bottles", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.collections.bottles.create({
        user: "me",
        collection: "default",
        bottle: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("rejects ambiguous target inputs without mutating collection membership", async ({
    fixtures,
    defaults,
  }) => {
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
    });
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    if (!target) throw new Error("Exact target fixture not found");
    type CreateInput = Parameters<
      typeof routerClient.collections.bottles.create
    >[0];
    const invalidInputs = [
      ["missing catalog reference", { user: "me", collection: collection.id }],
      [
        "combined Bottle and CatalogTarget",
        {
          user: "me",
          collection: collection.id,
          bottle: bottle.id,
          target: target.id,
        },
      ],
      [
        "combined CatalogTarget and BottleRelease",
        {
          user: "me",
          collection: collection.id,
          target: target.id,
          release: release.id,
        },
      ],
    ] as unknown as [string, CreateInput][];

    for (const [label, input] of invalidInputs) {
      const error = await waitError(() =>
        routerClient.collections.bottles.create(input, {
          context: { user: defaults.user },
        }),
      );
      expect(error, label).toMatchObject({
        code: "BAD_REQUEST",
        message: "Input validation failed",
      });
    }
    expect(
      await db.query.collectionBottles.findMany({
        where: eq(collectionBottles.collectionId, collection.id),
      }),
    ).toHaveLength(0);
  });

  test("adds bottle to default collection", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle();

    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "default",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    const bottleList = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));
    const target = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { eq }) => eq(catalogTargets.bottleId, bottle.id),
    });
    if (!target) throw new Error("Exact target fixture not found");

    expect(bottleList.length).toBe(1);
    expect(bottleList[0].targetId).toBe(target.id);
  });

  test("adds an exact Bottle through target-native input", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const target = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    if (!target) throw new Error("Exact target fixture not found");

    const result = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "default",
        target: target.id,
      },
      { context: { user: defaults.user } },
    );

    expect(result.target).toMatchObject({
      kind: "bottle",
      targetId: target.id,
      bottle: { id: bottle.id },
    });
  });

  test("does not invent retained Bottle identity for generic target creation", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, bottle.groupId as number),
        isNull(catalogTargets.bottleId),
      ),
    });
    if (!genericTarget) throw new Error("Generic target fixture not found");

    const error = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: "default",
          target: genericTarget.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(error.message).toBe(
      "Generic collection creation requires target-native collection storage.",
    );
  });

  test("stores the generic group target for a parent-only selection with releases", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: bottle.id });

    const result = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "default",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    const [membership] = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.id, result.id));
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, bottle.groupId as number),
        isNull(catalogTargets.bottleId),
      ),
    });
    if (!genericTarget) throw new Error("Generic target fixture not found");

    expect(membership.targetId).toBe(genericTarget.id);
    expect(membership.bottleId).toBe(bottle.id);
    expect(membership.releaseId).toBeNull();
  });

  test("upgrades a matching targetless membership without replacing unit data", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    const [legacyMembership] = await db
      .insert(collectionBottles)
      .values({
        collectionId: collection.id,
        bottleId: bottle.id,
        releaseId: null,
        targetId: null,
        imageUrl: "/uploads/collection-bottles/legacy.webp",
        status: "open",
      })
      .returning();
    const exactTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, bottle.id),
    });
    if (!exactTarget) throw new Error("Exact target fixture not found");

    const result = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: collection.id,
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    const [membership] = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.id, legacyMembership.id));
    const persistedCollection = await db.query.collections.findFirst({
      where: eq(collections.id, collection.id),
    });
    expect(result.id).toBe(legacyMembership.id);
    expect(membership).toMatchObject({
      targetId: exactTarget.id,
      imageUrl: "/uploads/collection-bottles/legacy.webp",
      status: "open",
    });
    expect(persistedCollection?.totalBottles).toBe(1);
  });

  test("rejects a matching retained pair owned by a different durable target", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 1,
    });
    const otherTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, otherBottle.id),
    });
    if (!otherTarget) throw new Error("Other exact target fixture not found");
    const [existingMembership] = await db
      .insert(collectionBottles)
      .values({
        collectionId: collection.id,
        bottleId: bottle.id,
        releaseId: null,
        targetId: otherTarget.id,
      })
      .returning();

    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: collection.id,
          bottle: bottle.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Collection membership has a conflicting catalog target.]`,
    );
    const [membership] = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.id, existingMembership.id));
    expect(membership.targetId).toBe(otherTarget.id);
  });

  test("consolidates a targetless pair duplicate into the canonical target membership", async ({
    fixtures,
    defaults,
  }) => {
    const selectedBottle = await fixtures.Bottle();
    const retainedBottle = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 2,
    });
    const selectedTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, selectedBottle.id),
    });
    if (!selectedTarget) {
      throw new Error("Selected exact target fixture not found");
    }
    const canonicalCreatedAt = new Date("2024-01-02T03:04:05.000Z");
    const [canonicalMembership] = await db
      .insert(collectionBottles)
      .values({
        collectionId: collection.id,
        bottleId: retainedBottle.id,
        releaseId: null,
        targetId: selectedTarget.id,
        imageUrl: null,
        status: "sealed",
        createdAt: canonicalCreatedAt,
      })
      .returning();
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: selectedBottle.id,
      releaseId: null,
      targetId: null,
      imageUrl: "/uploads/collection-bottles/legacy.webp",
      status: "open",
    });

    const result = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: collection.id,
        bottle: selectedBottle.id,
      },
      { context: { user: defaults.user } },
    );

    const memberships = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.collectionId, collection.id));
    const persistedCollection = await db.query.collections.findFirst({
      where: eq(collections.id, collection.id),
    });
    expect(result.id).toBe(canonicalMembership.id);
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      id: canonicalMembership.id,
      bottleId: retainedBottle.id,
      releaseId: null,
      targetId: selectedTarget.id,
      imageUrl: "/uploads/collection-bottles/legacy.webp",
      status: "sealed",
      createdAt: canonicalCreatedAt,
    });
    expect(persistedCollection?.totalBottles).toBe(1);
  });

  test("serializes different retained pairs for the same exact target", async ({
    fixtures,
    defaults,
  }) => {
    const parent = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const { promotedBottle, target } = await promoteRelease(release.id, parent);
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
    });
    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let legacyCreation:
      | ReturnType<typeof routerClient.collections.bottles.create>
      | undefined;

    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        'SELECT "id" FROM "catalog_target" WHERE "id" = $1 FOR UPDATE',
        [target.id],
      );
      const heldMembershipId = Number(
        (
          await client.query<{ id: string }>(
            `INSERT INTO "collection_bottle"
              ("collection_id", "bottle_id", "release_id", "target_id")
             VALUES ($1, $2, NULL, $3)
             RETURNING "id"`,
            [collection.id, promotedBottle.id, target.id],
          )
        ).rows[0]!.id,
      );
      await client.query(
        'UPDATE "collection" SET "total_bottles" = "total_bottles" + 1 WHERE "id" = $1',
        [collection.id],
      );

      legacyCreation = routerClient.collections.bottles.create(
        {
          user: "me",
          collection: collection.id,
          bottle: parent.id,
          release: release.id,
        },
        { context: { user: defaults.user } },
      );
      await waitForSessionsBlockedBy(client, blockerPid, 1);
      await client.query("COMMIT");
      committed = true;

      const legacyResult = await legacyCreation;

      const memberships = await db
        .select()
        .from(collectionBottles)
        .where(eq(collectionBottles.collectionId, collection.id));
      const persistedCollection = await db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      });
      expect(legacyResult.id).toBe(heldMembershipId);
      expect(memberships).toHaveLength(1);
      expect(memberships[0]).toMatchObject({
        bottleId: promotedBottle.id,
        releaseId: null,
        targetId: target.id,
      });
      expect(persistedCollection?.totalBottles).toBe(1);
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await legacyCreation?.catch(() => undefined);
    }
  });

  test("composes duplicate consolidation with a concurrent different-target create", async ({
    fixtures,
    defaults,
  }) => {
    const selectedBottle = await fixtures.Bottle();
    const retainedBottle = await fixtures.Bottle();
    const differentBottle = await fixtures.Bottle();
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
      totalBottles: 2,
    });
    const selectedTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, selectedBottle.id),
    });
    const differentTarget = await db.query.catalogTargets.findFirst({
      where: eq(catalogTargets.bottleId, differentBottle.id),
    });
    if (!selectedTarget || !differentTarget) {
      throw new Error("Exact target fixture not found");
    }
    const [canonicalMembership] = await db
      .insert(collectionBottles)
      .values({
        collectionId: collection.id,
        bottleId: retainedBottle.id,
        releaseId: null,
        targetId: selectedTarget.id,
      })
      .returning();
    await db.insert(collectionBottles).values({
      collectionId: collection.id,
      bottleId: selectedBottle.id,
      releaseId: null,
      targetId: null,
    });

    const client = new Client(getPostgresConnectionConfig());
    let committed = false;
    let consolidation:
      | ReturnType<typeof routerClient.collections.bottles.create>
      | undefined;
    await client.connect();
    try {
      await client.query("BEGIN");
      const blockerPid = (
        await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]!.pid;
      await client.query(
        'SELECT "id" FROM "catalog_target" WHERE "id" = $1 FOR UPDATE',
        [differentTarget.id],
      );
      await client.query(
        `INSERT INTO "collection_bottle"
          ("collection_id", "bottle_id", "release_id", "target_id")
         VALUES ($1, $2, NULL, $3)`,
        [collection.id, differentBottle.id, differentTarget.id],
      );
      await client.query(
        'UPDATE "collection" SET "total_bottles" = "total_bottles" + 1 WHERE "id" = $1',
        [collection.id],
      );

      consolidation = routerClient.collections.bottles.create(
        {
          user: "me",
          collection: collection.id,
          bottle: selectedBottle.id,
        },
        { context: { user: defaults.user } },
      );
      await waitForSessionsBlockedBy(client, blockerPid, 1);
      await client.query("COMMIT");
      committed = true;

      const consolidatedResult = await consolidation;
      const memberships = await db
        .select()
        .from(collectionBottles)
        .where(eq(collectionBottles.collectionId, collection.id));
      const persistedCollection = await db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      });
      expect(consolidatedResult.id).toBe(canonicalMembership.id);
      expect(memberships).toHaveLength(2);
      expect(memberships.map(({ targetId }) => targetId).sort()).toEqual(
        [selectedTarget.id, differentTarget.id].sort(),
      );
      expect(persistedCollection?.totalBottles).toBe(2);
    } finally {
      if (!committed) await client.query("ROLLBACK");
      await client.end();
      await consolidation?.catch(() => undefined);
    }
  });

  test("adds bottle to library collection", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle();

    const result = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    const libraryCollection = await db.query.collections.findFirst({
      where: (collections, { and, eq }) =>
        and(
          eq(collections.createdById, defaults.user.id),
          eq(collections.name, "Library"),
        ),
    });
    if (!libraryCollection) {
      throw new Error("Library collection not found");
    }

    const bottleList = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));

    expect(bottleList).toHaveLength(1);
    expect(bottleList[0].collectionId).toBe(libraryCollection.id);
    expect(bottleList[0].status).toBeNull();
    expect(result.status).toBeNull();
  });

  test("adds bottle to library collection with status", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();

    const result = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        status: "sealed",
      },
      { context: { user: defaults.user } },
    );

    const [collectionBottle] = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.id, result.id));

    expect(result.status).toBe("sealed");
    expect(collectionBottle.status).toBe("sealed");
  });

  test("stores library entry status independently per user", async ({
    fixtures,
    defaults,
  }) => {
    const otherUser = await fixtures.User();
    const bottle = await fixtures.Bottle();

    const defaultUserEntry = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        status: "sealed",
      },
      { context: { user: defaults.user } },
    );
    const otherUserEntry = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        status: "open",
      },
      { context: { user: otherUser } },
    );

    expect(defaultUserEntry.target.kind).toBe("bottle");
    expect(
      defaultUserEntry.target.kind === "bottle"
        ? defaultUserEntry.target.bottle.id
        : null,
    ).toBe(bottle.id);
    expect(defaultUserEntry.status).toBe("sealed");
    expect(otherUserEntry.target.kind).toBe("bottle");
    expect(
      otherUserEntry.target.kind === "bottle"
        ? otherUserEntry.target.bottle.id
        : null,
    ).toBe(bottle.id);
    expect(otherUserEntry.status).toBe("open");

    const defaultUserList = await routerClient.collections.bottles.list(
      {
        user: defaults.user.id,
        collection: "library",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );
    const otherUserList = await routerClient.collections.bottles.list(
      {
        user: otherUser.id,
        collection: "library",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    expect(defaultUserList.results[0].status).toBe("sealed");
    expect(otherUserList.results[0].status).toBe("open");
  });

  test("rejects status outside Library", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle();

    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: "default",
          bottle: bottle.id,
          status: "open",
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Bottle status is only supported for Library entries.]`,
    );

    const rows = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));
    expect(rows).toHaveLength(0);
  });

  test("saves a pending image when adding a bottle to library", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle({
      imageUrl: "/uploads/bottles/canonical.webp",
    });
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const result = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        pendingImageId: pendingUpload.id,
      },
      { context: { user: defaults.user } },
    );

    expect(result.imageUrl).toContain("/uploads/collection-bottles/");

    const [[collectionBottle], canonicalBottle] = await Promise.all([
      db
        .select()
        .from(collectionBottles)
        .where(eq(collectionBottles.id, result.id)),
      db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
    ]);

    expect(collectionBottle.imageUrl).toMatch(
      /^\/uploads\/collection-bottles\/collection_bottle-\d+-pending-upload-.+\.webp$/,
    );
    expect(canonicalBottle?.imageUrl).toBe("/uploads/bottles/canonical.webp");
  });

  test("saves a pending image when adding a release to library", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle({
      imageUrl: "/uploads/bottles/canonical.webp",
    });
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      imageUrl: "/uploads/bottle-releases/canonical-release.webp",
    });
    const { target } = await promoteRelease(release.id, bottle);
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const result = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        release: release.id,
        pendingImageId: pendingUpload.id,
      },
      { context: { user: defaults.user } },
    );

    expect(result.target.kind).toBe("bottle");
    expect(result.target.targetId).toBe(target.id);
    expect(result.imageUrl).toContain("/uploads/collection-bottles/");

    const [[collectionBottle], canonicalBottle, canonicalRelease] =
      await Promise.all([
        db
          .select()
          .from(collectionBottles)
          .where(eq(collectionBottles.id, result.id)),
        db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
        db.query.bottleReleases.findFirst({
          where: eq(bottleReleases.id, release.id),
        }),
      ]);

    expect(collectionBottle.releaseId).toBe(release.id);
    expect(collectionBottle.targetId).toBe(target.id);
    expect(collectionBottle.imageUrl).toMatch(
      /^\/uploads\/collection-bottles\/collection_bottle-\d+-pending-upload-.+\.webp$/,
    );
    expect(canonicalBottle?.imageUrl).toBe("/uploads/bottles/canonical.webp");
    expect(canonicalRelease?.imageUrl).toBe(
      "/uploads/bottle-releases/canonical-release.webp",
    );
  });

  test("updates an existing library entry image only when pending image is supplied", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const firstPendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });
    const secondPendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const first = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        pendingImageId: firstPendingUpload.id,
      },
      { context: { user: defaults.user } },
    );
    const second = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        pendingImageId: secondPendingUpload.id,
      },
      { context: { user: defaults.user } },
    );
    const third = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    expect(second.id).toBe(first.id);
    expect(second.imageUrl).not.toBe(first.imageUrl);
    expect(third.id).toBe(first.id);
    expect(third.imageUrl).toBe(second.imageUrl);

    const rows = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));
    expect(rows).toHaveLength(1);
  });

  test("updates existing library entry status only when explicitly supplied", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();

    const first = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        status: "open",
      },
      { context: { user: defaults.user } },
    );
    const second = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );
    const third = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        status: "empty",
      },
      { context: { user: defaults.user } },
    );
    const fourth = await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        status: null,
      },
      { context: { user: defaults.user } },
    );

    expect(second.id).toBe(first.id);
    expect(second.status).toBe("open");
    expect(third.id).toBe(first.id);
    expect(third.status).toBe("empty");
    expect(fourth.id).toBe(first.id);
    expect(fourth.status).toBeNull();

    const rows = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBeNull();
  });

  test("rejects collection images outside Library", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: "default",
          bottle: bottle.id,
          pendingImageId: pendingUpload.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Collection images are only supported for Library entries.]`,
    );

    const rows = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));
    expect(rows).toHaveLength(0);
  });

  test("rejects expired pending image before adding to library", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      ttlMs: -1000,
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: "library",
          bottle: bottle.id,
          pendingImageId: pendingUpload.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Pending upload has expired.]`);

    const rows = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));
    expect(rows).toHaveLength(0);
  });

  test("does not update existing library entry status when image copy fails", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const [entry] = await db
      .insert(collectionBottles)
      .values({
        collectionId: libraryCollection.id,
        bottleId: bottle.id,
        releaseId: null,
        imageUrl: "/uploads/collection-bottles/existing.webp",
        status: "open",
      })
      .returning();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      ttlMs: -1000,
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: "library",
          bottle: bottle.id,
          pendingImageId: pendingUpload.id,
          status: "empty",
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Pending upload has expired.]`);

    const [row] = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.id, entry.id));
    expect(row.imageUrl).toBe("/uploads/collection-bottles/existing.webp");
    expect(row.status).toBe("open");
  });

  test("fails and rolls back new library entry when image copy fails after validation", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });
    await db
      .update(pendingUploads)
      .set({ imageUrl: "/uploads/pending-uploads/missing-source.webp" })
      .where(eq(pendingUploads.id, pendingUpload.id));

    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: "library",
          bottle: bottle.id,
          pendingImageId: pendingUpload.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchObject({ code: "ENOENT" });

    const rows = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));
    expect(rows).toHaveLength(0);

    const libraryCollection = await db.query.collections.findFirst({
      where: (collections, { and, eq }) =>
        and(
          eq(collections.createdById, defaults.user.id),
          eq(collections.name, "Library"),
        ),
    });
    expect(libraryCollection?.totalBottles).toBe(0);
  });

  test("uses legacy non-library collection for default alias", async ({
    fixtures,
    defaults,
  }) => {
    const legacyCollection = await fixtures.Collection({
      name: "Personal Favorites",
      createdById: defaults.user.id,
    });
    await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const bottle = await fixtures.Bottle();

    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "default",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    const bottleList = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));
    const defaultCollection = await db.query.collections.findFirst({
      where: (collections, { and, eq }) =>
        and(
          eq(collections.createdById, defaults.user.id),
          eq(collections.name, "Default"),
        ),
    });

    expect(bottleList).toHaveLength(1);
    expect(bottleList[0].collectionId).toBe(legacyCollection.id);
    expect(defaultCollection).toBeUndefined();
  });

  test("adds multiple bottles without releases to default collection", async ({
    fixtures,
    defaults,
  }) => {
    const bottle1 = await fixtures.Bottle();
    const bottle2 = await fixtures.Bottle();

    // Add first bottle
    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "default",
        bottle: bottle1.id,
      },
      { context: { user: defaults.user } },
    );

    // Add second bottle
    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "default",
        bottle: bottle2.id,
      },
      { context: { user: defaults.user } },
    );

    // Get the actual default collection that was used
    const defaultCollection = await getDefaultCollection(db, defaults.user.id);
    if (!defaultCollection) {
      throw new Error("Default collection not found");
    }

    // Check both bottles are in the collection
    const bottleList = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.collectionId, defaultCollection.id));

    expect(bottleList.length).toBe(2);
    expect(bottleList.map((b) => b.bottleId).sort()).toEqual(
      [bottle1.id, bottle2.id].sort(),
    );
    expect(bottleList.every((b) => b.releaseId === null)).toBe(true);
  });

  test("adds bottle with release to default collection", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const { target } = await promoteRelease(release.id, bottle);

    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "default",
        bottle: bottle.id,
        release: release.id,
      },
      { context: { user: defaults.user } },
    );

    const bottleList = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));

    expect(bottleList.length).toBe(1);
    expect(bottleList[0].releaseId).toBe(release.id);
    expect(bottleList[0].targetId).toBe(target.id);
  });

  test("rejects an unmapped release without adding collection membership", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const collection = await fixtures.Collection({
      createdById: defaults.user.id,
    });

    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: collection.id,
          bottle: bottle.id,
          release: release.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err.message).toContain("completed promotion mapping");
    expect(
      await db.query.collectionBottles.findMany({
        where: eq(collectionBottles.collectionId, collection.id),
      }),
    ).toHaveLength(0);
    const persistedCollection = await db.query.collections.findFirst({
      where: eq(collections.id, collection.id),
    });
    expect(persistedCollection?.totalBottles).toBe(0);
  });

  test("adds bottle with release to library collection", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const { target } = await promoteRelease(release.id, bottle);

    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: bottle.id,
        release: release.id,
      },
      { context: { user: defaults.user } },
    );

    const bottleList = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));

    expect(bottleList).toHaveLength(1);
    expect(bottleList[0].releaseId).toBe(release.id);
    expect(bottleList[0].targetId).toBe(target.id);
  });

  test("allows saving the base bottle and a specific release separately", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const { target } = await promoteRelease(release.id, bottle);

    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "default",
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "default",
        bottle: bottle.id,
        release: release.id,
      },
      { context: { user: defaults.user } },
    );

    const bottleList = await db
      .select()
      .from(collectionBottles)
      .where(eq(collectionBottles.bottleId, bottle.id));

    expect(bottleList).toHaveLength(2);
    expect(bottleList.some((item) => item.releaseId === null)).toBeTruthy();
    expect(
      bottleList.some((item) => item.releaseId === release.id),
    ).toBeTruthy();
    expect(bottleList.some((item) => item.targetId === target.id)).toBeTruthy();
  });

  test("fails with invalid release", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: otherBottle.id });

    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: "default",
          bottle: bottle.id,
          release: release.id,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Cannot identify release.]`);
  });

  test("fails with nonexistent release", async ({ fixtures, defaults }) => {
    const bottle = await fixtures.Bottle();

    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: "default",
          bottle: bottle.id,
          release: 12345,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Cannot identify release.]`);
  });

  test("fails with nonexistent bottle", async ({ fixtures, defaults }) => {
    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: "default",
          bottle: 99999,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Cannot find bottle.]`);
  });

  test("prevents modifying another user's collection", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherUser = await fixtures.User();
    const collection = await fixtures.Collection({ createdById: otherUser.id });

    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: "me",
          collection: collection.id,
          bottle: bottle.id,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot modify another user's collection.]`,
    );
  });

  test("prevents modifying another user's library", async ({
    fixtures,
    defaults,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherUser = await fixtures.User();

    const err = await waitError(() =>
      routerClient.collections.bottles.create(
        {
          user: otherUser.id,
          collection: "library",
          bottle: bottle.id,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot modify another user's collection.]`,
    );
  });

  test("resolves default and library by reserved name", async ({
    fixtures,
    defaults,
  }) => {
    const libraryCollection = await fixtures.Collection({
      name: "Library",
      createdById: defaults.user.id,
    });
    const defaultCollection = await fixtures.Collection({
      name: "Default",
      createdById: defaults.user.id,
    });
    const favoriteBottle = await fixtures.Bottle();
    const libraryBottle = await fixtures.Bottle();

    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "default",
        bottle: favoriteBottle.id,
      },
      { context: { user: defaults.user } },
    );
    await routerClient.collections.bottles.create(
      {
        user: "me",
        collection: "library",
        bottle: libraryBottle.id,
      },
      { context: { user: defaults.user } },
    );

    const bottleList = await db.select().from(collectionBottles);

    expect(
      bottleList.find((item) => item.bottleId === favoriteBottle.id)
        ?.collectionId,
    ).toBe(defaultCollection.id);
    expect(
      bottleList.find((item) => item.bottleId === libraryBottle.id)
        ?.collectionId,
    ).toBe(libraryCollection.id);
  });
});
