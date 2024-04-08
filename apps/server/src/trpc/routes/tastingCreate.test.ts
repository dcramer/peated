import { db } from "@peated/server/db";
import { eq } from "drizzle-orm";
import { bottles, entities, tastings } from "../../db/schema";
import { createCaller } from "../router";

test("requires auth", async () => {
  const caller = createCaller({
    user: null,
  });
  expect(() => caller.tastingCreate({ bottle: 1 })).rejects.toThrowError(
    /UNAUTHORIZED/,
  );
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

  expect(data.id).toBeDefined();

  const [tasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, data.id));

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
  const bottle = await fixtures.Bottle();

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingCreate({
    bottle: bottle.id,
    rating: 3.5,
    tags: ["cherry", "PEAT"],
  });

  expect(data.id).toBeDefined();

  const [tasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, data.id));

  expect(tasting.bottleId).toEqual(bottle.id);
  expect(tasting.createdById).toEqual(defaults.user.id);
  expect(tasting.tags).toEqual(["cherry", "peat"]);

  const tags = await db.query.bottleTags.findMany({
    where: (bottleTags, { eq }) => eq(bottleTags.bottleId, tasting.bottleId),
    orderBy: (bottleTags, { asc }) => asc(bottleTags.tag),
  });
  expect(tags.length).toBe(2);
  expect(tags[0].tag).toBe("cherry");
  expect(tags[0].count).toBe(1);
  expect(tags[1].tag).toBe("peat");
  expect(tags[1].count).toBe(1);
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

  expect(data.id).toBeDefined();

  const [tasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, data.id));

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

  expect(data.id).toBeDefined();

  const [tasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, data.id));

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

  expect(data.id).toBeDefined();

  const [tasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, data.id));

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

  expect(data.id).toBeDefined();

  const [tasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, data.id));

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

  expect(() =>
    caller.tastingCreate({
      bottle: bottle.id,
      flight: flight.publicId,
    }),
  ).rejects.toThrowError(/Cannot identify flight/);
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

  expect(data.id).toBeDefined();

  const [tasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, data.id));

  expect(tasting.bottleId).toEqual(bottle.id);
  expect(tasting.createdById).toEqual(defaults.user.id);
  expect(tasting.flightId).toEqual(flight.id);
});
