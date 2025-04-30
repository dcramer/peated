import { db } from "@peated/server/db";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { bottles, entities, tastings } from "../db/schema";
import { createCaller } from "../trpc/router";

test("requires auth", async () => {
  const caller = createCaller({
    user: null,
  });
  const err = await waitError(caller.tastingCreate({ bottle: 1 }));
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
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

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingCreate({
    bottle: bottle.id,
    rating: 3.5,
  });

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

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingCreate({
    bottle: bottle.id,
    rating: 3.5,
    tags: [tags[0].name, tags[1].name],
  });

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

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingCreate({
    bottle: bottle.id,
    rating: 3.5,
    notes: "hello world",
  });

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

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingCreate({
    bottle: bottle.id,
  });

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

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingCreate({
    bottle: bottle.id,
    friends: [],
  });

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

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingCreate({
    bottle: bottle.id,
    rating: 0,
  });

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

  const caller = createCaller({
    user: defaults.user,
  });

  const err = await waitError(
    caller.tastingCreate({
      bottle: bottle.id,
      flight: flight.publicId,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: Cannot identify flight.]`);
});

test("creates a new tasting with flight", async ({ defaults, fixtures }) => {
  const bottle = await fixtures.Bottle();
  const flight = await fixtures.Flight({ bottles: [bottle.id] });

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingCreate({
    bottle: bottle.id,
    flight: flight.publicId,
  });

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

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingCreate({
    bottle: bottle.id,
  });

  expect(data.tasting.id).toBeDefined();

  const [tasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, data.tasting.id));

  expect(tasting.bottleId).toEqual(bottle.id);
  expect(tasting.createdById).toEqual(defaults.user.id);

  expect(data.awards).toBeDefined();
  expect(data.awards.length).toEqual(1);
  expect(data.awards[0].badge).toMatchInlineSnapshot(`
    {
      "id": 1,
      "imageUrl": "http://localhost:4000/images/foobar.png",
      "maxLevel": 10,
      "name": "Consistency",
    }
  `);
});

test("creates a new tasting with release", async ({ defaults, fixtures }) => {
  const bottle = await fixtures.Bottle();
  const release = await fixtures.BottleRelease({
    bottleId: bottle.id,
  });

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingCreate({
    bottle: bottle.id,
    release: release.id,
  });

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

  const caller = createCaller({
    user: defaults.user,
  });

  const err = await waitError(
    caller.tastingCreate({
      bottle: bottle.id,
      release: release.id,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: Cannot identify release.]`);
});

test("fails with nonexistent release", async ({ defaults, fixtures }) => {
  const bottle = await fixtures.Bottle();

  const caller = createCaller({
    user: defaults.user,
  });

  const err = await waitError(
    caller.tastingCreate({
      bottle: bottle.id,
      release: 12345,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: Cannot identify release.]`);
});

test("creates a new tasting with serving style and color", async ({
  defaults,
  fixtures,
}) => {
  const bottle = await fixtures.Bottle();

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingCreate({
    bottle: bottle.id,
    servingStyle: "neat",
    color: 5,
  });

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

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingCreate({
    bottle: bottle.id,
    createdAt: customDate.toISOString(),
  });

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

  const caller = createCaller({
    user: defaults.user,
  });
  const err = await waitError(
    caller.tastingCreate({
      bottle: bottle.id,
      createdAt: oldDate.toISOString(),
    }),
  );
  expect(err).toMatchInlineSnapshot(`
    [TRPCError: [
      {
        "code": "custom",
        "message": "Value too far in the past.",
        "path": [
          "createdAt"
        ]
      }
    ]]
  `);
});

test("fails with future date", async ({ defaults, fixtures }) => {
  const bottle = await fixtures.Bottle();
  const futureDate = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes in future

  const caller = createCaller({
    user: defaults.user,
  });
  const err = await waitError(
    caller.tastingCreate({
      bottle: bottle.id,
      createdAt: futureDate.toISOString(),
    }),
  );
  expect(err).toMatchInlineSnapshot(`
    [TRPCError: [
      {
        "code": "custom",
        "message": "Value too far in future.",
        "path": [
          "createdAt"
        ]
      }
    ]]
  `);
});

test("fails with non-following friends", async ({ defaults, fixtures }) => {
  const bottle = await fixtures.Bottle();
  const nonFriend = await fixtures.User();

  const caller = createCaller({
    user: defaults.user,
  });
  const err = await waitError(
    caller.tastingCreate({
      bottle: bottle.id,
      friends: [nonFriend.id],
    }),
  );
  expect(err).toMatchInlineSnapshot(
    `[TRPCError: Friends must all be active relationships.]`,
  );
});

test("creates a new tasting with friends", async ({ defaults, fixtures }) => {
  const bottle = await fixtures.Bottle();
  const friend = await fixtures.User();
  await fixtures.Follow({
    fromUserId: defaults.user.id,
    toUserId: friend.id,
  });

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingCreate({
    bottle: bottle.id,
    friends: [friend.id],
  });

  expect(data.tasting.id).toBeDefined();

  const [tasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, data.tasting.id));

  expect(tasting.friends).toEqual([friend.id]);
});

test("prevents duplicate tastings", async ({ defaults, fixtures }) => {
  const bottle = await fixtures.Bottle();
  const caller = createCaller({
    user: defaults.user,
  });

  const createdAt = new Date().toISOString();

  const data = await caller.tastingCreate({
    bottle: bottle.id,
    createdAt,
    rating: 4.0,
  });

  expect(data.tasting.id).toBeDefined();

  const err = await waitError(
    caller.tastingCreate({
      bottle: bottle.id,
      createdAt,
      rating: 4.0,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: Tasting already exists.]`);
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

  const caller = createCaller({
    user: defaults.user,
  });
  await caller.tastingCreate({
    bottle: bottle.id,
    rating: 4.5,
  });

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

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingCreate({
    bottle: bottle.id,
    release: release.id,
    flight: flight.publicId,
    rating: 4.0,
  });

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

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingCreate({
    bottle: bottle.id,
    rating: 4.0,
  });

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

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingCreate({
    bottle: bottle.id,
    servingStyle: "neat",
  });

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

  const caller = createCaller({
    user: defaults.user,
  });
  const err = await waitError(
    caller.tastingCreate({
      bottle: bottle.id,
      friends: [friend.id],
    }),
  );
  expect(err).toMatchInlineSnapshot(
    `[TRPCError: Friends must all be active relationships.]`,
  );
});
