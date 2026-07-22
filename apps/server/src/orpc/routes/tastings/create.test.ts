import { db } from "@peated/server/db";
import {
  badgeAwardTrackedObjects,
  bottleAliases,
  bottleReleasePromotions,
  bottleReleases,
  bottleTombstones,
  bottles,
  catalogTargets,
  entities,
  flightBottles,
  pendingUploads,
  tastings,
} from "@peated/server/db/schema";
import { createPendingImageUpload } from "@peated/server/lib/pendingUploads";
import waitError from "@peated/server/lib/test/waitError";
import { compressAndResizeImage } from "@peated/server/lib/uploads";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@peated/server/worker/client", async (importOriginal) => ({
  ...(await importOriginal<typeof workerClient>()),
  pushJob: vi.fn().mockResolvedValue(undefined),
}));

const STATS_JOB_OPTIONS = {
  delay: 5000,
  removeOnComplete: true,
  removeOnFail: false,
};

async function promoteRelease(
  releaseId: number,
  bottleId: number,
  createdByActorId: number,
) {
  await db.insert(bottleReleasePromotions).values({
    releaseId,
    promotedBottleId: bottleId,
    status: "promoted",
    completedAt: new Date(),
    createdByActorId,
  });
}

describe("POST /tastings", () => {
  beforeEach(() => {
    vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
  });

  test("requires auth", async () => {
    const err = await waitError(() =>
      routerClient.tastings.create({ bottle: 1 }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("creates a new tasting with minimal params", async ({
    defaults,
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ type: ["brand", "distiller"] });
    const bottle = await fixtures.Bottle({
      brandId: entity.id,
      distillerIds: [entity.id],
    });

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        rating: 1,
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.id).toBeDefined();

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.tasting.id));

    expect(tasting.bottleId).toEqual(bottle.id);
    expect(tasting.createdById).toEqual(defaults.user.id);
    expect(tasting.rating).toEqual(1);
    expect(tasting.notes).toBeNull();
    const target = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { eq }) => eq(catalogTargets.bottleId, bottle.id),
    });
    expect(tasting.targetId).toBe(target?.id);

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(newBottle.totalTastings).toBe(0);

    const [newEntity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, entity.id));
    expect(newEntity.totalTastings).toBe(0);
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { targetId: target?.id },
      STATS_JOB_OPTIONS,
    );
  });

  test("keeps the tasting and target when stats publication fails", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    vi.mocked(workerClient.pushJob).mockImplementation(async (name) => {
      if (name === "UpdateBottleStats") {
        throw new Error("stats queue unavailable");
      }
      return undefined;
    });

    const result = await routerClient.tastings.create(
      { bottle: bottle.id, rating: 2 },
      { context: { user: defaults.user } },
    );

    const tasting = await db.query.tastings.findFirst({
      where: eq(tastings.id, result.tasting.id),
    });
    const target = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { eq }) => eq(catalogTargets.bottleId, bottle.id),
    });
    expect(tasting).toMatchObject({
      id: result.tasting.id,
      bottleId: bottle.id,
      targetId: target?.id,
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { targetId: target?.id },
      STATS_JOB_OPTIONS,
    );
  });

  test("creates a generic tasting for a parent-only legacy reference", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.BottleRelease({ bottleId: bottle.id });

    const result = await routerClient.tastings.create(
      { bottle: bottle.id },
      { context: { user: defaults.user } },
    );

    const tasting = await db.query.tastings.findFirst({
      where: eq(tastings.id, result.tasting.id),
    });
    const target = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { and, eq, isNull }) =>
        and(
          eq(catalogTargets.groupId, bottle.groupId as number),
          isNull(catalogTargets.bottleId),
        ),
    });
    expect(tasting?.targetId).toBe(target?.id);
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleGroupStats",
      { targetId: target?.id },
      STATS_JOB_OPTIONS,
    );
  });

  test("creates a tasting using a merged bottle id", async ({
    defaults,
    fixtures,
  }) => {
    const sourceBottle = await fixtures.LegacyBottle();
    const targetBottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: sourceBottle.id });
    const flight = await fixtures.Flight({ bottles: [sourceBottle.id] });

    await db.transaction(async (tx) => {
      await tx
        .update(bottleReleases)
        .set({ bottleId: targetBottle.id })
        .where(eq(bottleReleases.id, release.id));
      await tx
        .update(flightBottles)
        .set({ bottleId: targetBottle.id })
        .where(eq(flightBottles.flightId, flight.id));
      await tx
        .update(bottleAliases)
        .set({ bottleId: targetBottle.id })
        .where(eq(bottleAliases.bottleId, sourceBottle.id));
      await tx.insert(bottleTombstones).values({
        bottleId: sourceBottle.id,
        newBottleId: targetBottle.id,
      });
      await tx.delete(bottles).where(eq(bottles.id, sourceBottle.id));
    });
    await promoteRelease(
      release.id,
      targetBottle.id,
      targetBottle.createdByActorId,
    );

    const data = await routerClient.tastings.create(
      {
        bottle: sourceBottle.id,
        release: release.id,
        flight: flight.publicId,
        rating: 2,
      },
      { context: { user: defaults.user } },
    );

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.tasting.id));

    expect(tasting.bottleId).toEqual(targetBottle.id);
    expect(tasting.releaseId).toEqual(release.id);
    expect(tasting.flightId).toEqual(flight.id);
    expect(tasting.targetId).not.toBeNull();
  });

  test("attaches a pending photo upload to the new tasting", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "photo_tasting_entry",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        pendingImageId: pendingUpload.id,
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.imageUrl).toContain("/uploads/tastings/");

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.tasting.id));
    expect(tasting.imageUrl).toMatch(
      /^\/uploads\/tastings\/tasting-\d+-pending-upload-.+\.webp$/,
    );

    const attachedUpload = await db.query.pendingUploads.findFirst({
      where: eq(pendingUploads.id, pendingUpload.id),
    });
    expect(attachedUpload).toMatchObject({
      status: "attached",
      attachedToType: null,
      attachedToId: null,
    });
  });

  test("rejects an unusable pending photo upload before creating the tasting", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const pendingUpload = await createPendingImageUpload({
      file: await fixtures.SampleSquareImage(),
      createdById: defaults.user.id,
      purpose: "avatar",
      onProcess: (...args) => compressAndResizeImage(...args, 1600, 1600),
    });

    const err = await waitError(() =>
      routerClient.tastings.create(
        {
          bottle: bottle.id,
          pendingImageId: pendingUpload.id,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Pending upload purpose mismatch.]`,
    );

    const tastingRows = await db
      .select()
      .from(tastings)
      .where(eq(tastings.bottleId, bottle.id));
    expect(tastingRows).toHaveLength(0);
  });

  test("creates a new tasting with tags", async ({ defaults, fixtures }) => {
    const tags = [
      await fixtures.Tag({
        name: "cherry",
      }),
      await fixtures.Tag({
        name: "peat",
      }),
    ];

    const bottle = await fixtures.Bottle();

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        rating: 1,
        tags: [tags[0].name, tags[1].name],
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.id).toBeDefined();

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.tasting.id));

    expect(tasting.bottleId).toEqual(bottle.id);
    expect(tasting.createdById).toEqual(defaults.user.id);
    expect(tasting.tags).toEqual([tags[0].name, tags[1].name]);

    const bTags = await db.query.bottleTags.findMany({
      where: (bottleTags, { eq }) => eq(bottleTags.bottleId, tasting.bottleId),
      orderBy: (bottleTags, { asc }) => asc(bottleTags.tag),
    });
    expect(bTags.length).toBe(2);
    expect(bTags[0].tag).toBe(tags[0].name);
    expect(bTags[0].count).toBe(1);
    expect(bTags[1].tag).toBe(tags[1].name);
    expect(bTags[1].count).toBe(1);
  });

  test("creates a new tasting with notes", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        rating: 1,
        notes: "hello world",
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.id).toBeDefined();

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.tasting.id));

    expect(tasting.notes).toEqual("hello world");
  });

  test("creates a new tasting with empty rating", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.id).toBeDefined();

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.tasting.id));

    expect(tasting.bottleId).toEqual(bottle.id);
    expect(tasting.createdById).toEqual(defaults.user.id);
    expect(tasting.rating).toBeNull();
  });

  test("creates a new tasting with empty friends", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        friends: [],
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.id).toBeDefined();

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.tasting.id));

    expect(tasting.bottleId).toEqual(bottle.id);
    expect(tasting.createdById).toEqual(defaults.user.id);
    expect(tasting.friends).toEqual([]);
  });

  test("creates a new tasting with pass rating", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        rating: -1,
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.id).toBeDefined();

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.tasting.id));

    expect(tasting.bottleId).toEqual(bottle.id);
    expect(tasting.createdById).toEqual(defaults.user.id);
    expect(tasting.rating).toEqual(-1);
  });

  test("flight requires valid bottle", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    const flight = await fixtures.Flight();

    const err = await waitError(() =>
      routerClient.tastings.create(
        {
          bottle: bottle.id,
          flight: flight.publicId,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Cannot identify flight.]`);
  });

  test("creates a new tasting with flight", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    const flight = await fixtures.Flight({ bottles: [bottle.id] });

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        flight: flight.publicId,
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.id).toBeDefined();

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.tasting.id));

    expect(tasting.bottleId).toEqual(bottle.id);
    expect(tasting.createdById).toEqual(defaults.user.id);
    expect(tasting.flightId).toEqual(flight.id);
  });

  test("creates a new tasting with badge award", async ({
    defaults,
    fixtures,
  }) => {
    const badge = await fixtures.Badge({
      checks: [
        {
          type: "age",
          config: {
            minAge: 5,
            maxAge: 10,
          },
        },
      ],
      name: "Consistency",
      maxLevel: 10,
      imageUrl: "/images/foobar.png",
    });

    const bottle = await fixtures.Bottle({ statedAge: 5 });

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.id).toBeDefined();

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.tasting.id));

    expect(tasting.bottleId).toEqual(bottle.id);
    expect(tasting.createdById).toEqual(defaults.user.id);

    expect(data.awards).toBeDefined();
    expect(data.awards.length).toEqual(1);
    expect(data.awards[0].badge).toMatchObject({
      id: 1,
      imageUrl: expect.stringContaining("/images/foobar.png"),
      maxLevel: 10,
      name: "Consistency",
    });
  });

  test("creates a new tasting with release", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    const [promotedBottle] = await db
      .insert(bottles)
      .values({
        groupId: bottle.groupId,
        brandId: bottle.brandId,
        createdByActorId: bottle.createdByActorId,
        name: `${bottle.name} promoted`,
        fullName: `${bottle.fullName} promoted`,
      })
      .returning();
    if (!promotedBottle) {
      throw new Error("Unable to create promoted Bottle fixture");
    }
    await db.insert(catalogTargets).values({
      groupId: bottle.groupId as number,
      bottleId: promotedBottle.id,
    });
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
    });
    await promoteRelease(
      release.id,
      promotedBottle.id,
      bottle.createdByActorId,
    );

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        release: release.id,
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.id).toBeDefined();

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.tasting.id));

    expect(tasting.releaseId).toEqual(release.id);
    expect(tasting.bottleId).toEqual(bottle.id);
    const target = await db.query.catalogTargets.findFirst({
      where: (catalogTargets, { eq }) =>
        eq(catalogTargets.bottleId, promotedBottle.id),
    });
    expect(tasting.targetId).toBe(target?.id);
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { targetId: target?.id },
      STATS_JOB_OPTIONS,
    );
  });

  test("awards a promoted release from its exact Bottle identity", async ({
    defaults,
    fixtures,
  }) => {
    const parent = await fixtures.Bottle({ statedAge: 5 });
    const [promotedBottle] = await db
      .insert(bottles)
      .values({
        groupId: parent.groupId,
        brandId: parent.brandId,
        createdByActorId: parent.createdByActorId,
        name: `${parent.name} promoted badge bottle`,
        fullName: `${parent.fullName} promoted badge bottle`,
        statedAge: 21,
      })
      .returning();
    if (!promotedBottle) {
      throw new Error("Unable to create promoted Bottle fixture");
    }
    const [target] = await db
      .insert(catalogTargets)
      .values({
        groupId: parent.groupId as number,
        bottleId: promotedBottle.id,
      })
      .returning();
    if (!target) throw new Error("Unable to create promoted target fixture");
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    await promoteRelease(
      release.id,
      promotedBottle.id,
      parent.createdByActorId,
    );
    const badge = await fixtures.Badge({
      name: "Promoted exact Bottle",
      tracker: "bottle",
      checks: [
        { type: "age", config: { minAge: 21, maxAge: 21 } },
        { type: "bottle", config: { bottle: [promotedBottle.id] } },
      ],
    });

    const data = await routerClient.tastings.create(
      { bottle: parent.id, release: release.id },
      { context: { user: defaults.user } },
    );

    expect(data.awards).toHaveLength(1);
    expect(data.awards[0]?.badge.id).toBe(badge.id);
    expect(
      await db
        .select({
          objectType: badgeAwardTrackedObjects.objectType,
          objectId: badgeAwardTrackedObjects.objectId,
        })
        .from(badgeAwardTrackedObjects),
    ).toEqual([{ objectType: "bottle", objectId: promotedBottle.id }]);
    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, data.tasting.id),
        columns: {
          bottleId: true,
          releaseId: true,
          targetId: true,
        },
      }),
    ).toEqual({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: target.id,
    });
  });

  test("rejects an unmapped release without inserting a tasting", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });

    const err = await waitError(() =>
      routerClient.tastings.create(
        { bottle: bottle.id, release: release.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain("completed promotion mapping");
    expect(
      await db.query.tastings.findMany({
        where: eq(tastings.bottleId, bottle.id),
      }),
    ).toHaveLength(0);
  });

  test("fails with invalid release", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: otherBottle.id });

    const err = await waitError(() =>
      routerClient.tastings.create(
        {
          bottle: bottle.id,
          release: release.id,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Cannot identify release.]`);
  });

  test("fails with nonexistent release", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();

    const err = await waitError(() =>
      routerClient.tastings.create(
        {
          bottle: bottle.id,
          release: 12345,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Cannot identify release.]`);
  });

  test("creates a new tasting with serving style and color", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        servingStyle: "neat",
        color: 5,
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.id).toBeDefined();

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.tasting.id));

    expect(tasting.servingStyle).toEqual("neat");
    expect(tasting.color).toEqual(5);
  });

  test("creates a new tasting with custom date", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const customDate = new Date(Date.now() - 1000 * 60 * 60 * 24); // 1 day ago

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        createdAt: customDate.toISOString(),
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.id).toBeDefined();

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.tasting.id));

    expect(tasting.createdAt.toISOString()).toEqual(customDate.toISOString());
  });

  test("fails with date too far in past", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    const oldDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 8); // 8 days ago

    const err = await waitError(() =>
      routerClient.tastings.create(
        {
          bottle: bottle.id,
          createdAt: oldDate.toISOString(),
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("fails with future date", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    const futureDate = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes in future

    const err = await waitError(() =>
      routerClient.tastings.create(
        {
          bottle: bottle.id,
          createdAt: futureDate.toISOString(),
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("fails with non-following friends", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    const nonFriend = await fixtures.User();

    const err = await waitError(() =>
      routerClient.tastings.create(
        {
          bottle: bottle.id,
          friends: [nonFriend.id],
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Friends must all be active relationships.]`,
    );
  });

  test("creates a new tasting with friends", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    const friend = await fixtures.User();
    await fixtures.Follow({
      fromUserId: defaults.user.id,
      toUserId: friend.id,
    });

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        friends: [friend.id],
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.id).toBeDefined();

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.tasting.id));

    expect(tasting.friends).toEqual([friend.id]);
  });

  test("prevents duplicate tastings", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    const createdAt = new Date().toISOString();

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        createdAt,
        rating: 2,
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.id).toBeDefined();

    const err = await waitError(() =>
      routerClient.tastings.create(
        {
          bottle: bottle.id,
          createdAt,
          rating: 2,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Tasting already exists.]`);
  });

  test("translates duplicate durable targets to a conflict", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const firstRelease = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Duplicate Target First Edition",
      name: "Duplicate Durable Target First",
      fullName: "Fixture Duplicate Durable Target First",
    });
    const secondRelease = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Duplicate Target Second Edition",
      name: "Duplicate Durable Target Second",
      fullName: "Fixture Duplicate Durable Target Second",
    });
    await promoteRelease(firstRelease.id, bottle.id, bottle.createdByActorId);
    await promoteRelease(secondRelease.id, bottle.id, bottle.createdByActorId);
    const createdAt = new Date().toISOString();

    await routerClient.tastings.create(
      { bottle: bottle.id, release: firstRelease.id, createdAt },
      { context: { user: defaults.user } },
    );
    const err = await waitError(() =>
      routerClient.tastings.create(
        { bottle: bottle.id, release: secondRelease.id, createdAt },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Tasting already exists.]`);
  });

  test("creates a new tasting with both flight and release", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    await promoteRelease(release.id, bottle.id, bottle.createdByActorId);
    const flight = await fixtures.Flight({ bottles: [bottle.id] });

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        release: release.id,
        flight: flight.publicId,
        rating: 2,
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.id).toBeDefined();

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.tasting.id));

    expect(tasting.bottleId).toEqual(bottle.id);
    expect(tasting.releaseId).toEqual(release.id);
    expect(tasting.flightId).toEqual(flight.id);
    expect(tasting.createdById).toEqual(defaults.user.id);
    expect(tasting.rating).toEqual(2);
  });

  test("creates a new tasting with color", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        rating: 2,
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.id).toBeDefined();

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.tasting.id));

    expect(tasting.bottleId).toEqual(bottle.id);
    expect(tasting.createdById).toEqual(defaults.user.id);
    expect(tasting.rating).toEqual(2);
  });

  test("creates a new tasting with serving style", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        servingStyle: "neat",
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.id).toBeDefined();

    const [tasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.tasting.id));

    expect(tasting.servingStyle).toEqual("neat");
  });

  test("fails with non-following friend", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    const friend = await fixtures.User();

    const err = await waitError(() =>
      routerClient.tastings.create(
        {
          bottle: bottle.id,
          friends: [friend.id],
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Friends must all be active relationships.]`,
    );
  });
});
