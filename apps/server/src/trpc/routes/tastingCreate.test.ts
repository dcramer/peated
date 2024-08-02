import { db } from "@peated/server/db";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { bottles, entities, tastings } from "../../db/schema";
import { createCaller } from "../router";

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
