import { db } from "@peated/server/db";
import { bottles, entities, tastings } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("POST /tastings", () => {
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
        rating: 3.5,
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
    expect(tasting.rating).toEqual(3.5);
    expect(tasting.notes).toBeNull();

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(newBottle.totalTastings).toBe(1);

    const [newEntity] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, entity.id));
    expect(newEntity.totalTastings).toBe(1);
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
        rating: 3.5,
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
        rating: 3.5,
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

  test("creates a new tasting with zero rating", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        rating: 0,
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
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
    });

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
        rating: 4.0,
      },
      { context: { user: defaults.user } },
    );

    expect(data.tasting.id).toBeDefined();

    const err = await waitError(() =>
      routerClient.tastings.create(
        {
          bottle: bottle.id,
          createdAt,
          rating: 4.0,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Tasting already exists.]`);
  });

  test("updates entity stats correctly", async ({ defaults, fixtures }) => {
    const brand = await fixtures.Entity({ type: ["brand"] });
    const distiller = await fixtures.Entity({ type: ["distiller"] });
    const bottler = await fixtures.Entity({ type: ["bottler"] });

    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: bottler.id,
      distillerIds: [distiller.id],
    });

    await routerClient.tastings.create(
      {
        bottle: bottle.id,
        rating: 4.5,
      },
      { context: { user: defaults.user } },
    );

    const updatedBrand = await db.query.entities.findFirst({
      where: eq(entities.id, brand.id),
    });
    const updatedDistiller = await db.query.entities.findFirst({
      where: eq(entities.id, distiller.id),
    });
    const updatedBottler = await db.query.entities.findFirst({
      where: eq(entities.id, bottler.id),
    });

    expect(updatedBrand?.totalTastings).toBe(1);
    expect(updatedDistiller?.totalTastings).toBe(1);
    expect(updatedBottler?.totalTastings).toBe(1);

    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(updatedBottle.totalTastings).toBe(1);
    expect(updatedBottle.avgRating).toBe(4.5);
  });

  test("creates a new tasting with both flight and release", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const flight = await fixtures.Flight({ bottles: [bottle.id] });

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        release: release.id,
        flight: flight.publicId,
        rating: 4.0,
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
    expect(tasting.rating).toEqual(4.0);
  });

  test("creates a new tasting with color", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();

    const data = await routerClient.tastings.create(
      {
        bottle: bottle.id,
        rating: 4.0,
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
    expect(tasting.rating).toEqual(4.0);
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
