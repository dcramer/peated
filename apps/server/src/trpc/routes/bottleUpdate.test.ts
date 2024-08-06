import { db } from "@peated/server/db";
import {
  bottles,
  bottlesToDistillers,
  entities,
} from "@peated/server/db/schema";
import { omit } from "@peated/server/lib/filter";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(
    caller.bottleUpdate({
      bottle: 1,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("requires mod", async ({ defaults }) => {
  const caller = createCaller({ user: defaults.user });
  const err = await waitError(
    caller.bottleUpdate({
      bottle: 1,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("no changes", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle();

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.bottleUpdate({
    bottle: bottle.id,
  });

  expect(data.id).toBeDefined();

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));

  expect(omit(bottle, "updatedAt")).toEqual(omit(newBottle, "updatedAt"));
});

test("edits a new bottle with new name param", async ({ fixtures }) => {
  const brand = await fixtures.Entity();
  const bottle = await fixtures.Bottle({
    brandId: brand.id,
    name: "Nice Oak",
    vintageYear: null,
    releaseYear: null,
    edition: null,
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.bottleUpdate({
    bottle: bottle.id,
    name: "Delicious Wood",
  });

  expect(data.id).toBeDefined();

  const [bottle2] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));

  expect(bottle2.name).toBe("Delicious Wood");
  expect(bottle2.fullName).toBe(`${brand.name} ${bottle2.name}`);
});

test("clears category", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle({ category: "single_malt" });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const data = await caller.bottleUpdate({
    bottle: bottle.id,
    category: null,
  });

  expect(data.id).toBeDefined();

  const [bottle2] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));

  expect(omit(bottle, "category", "updatedAt")).toEqual(
    omit(bottle2, "category", "updatedAt"),
  );
  expect(bottle2.category).toBe(null);
});

test("manipulates name to conform with age", async ({ fixtures }) => {
  const brand = await fixtures.Entity();
  const bottle = await fixtures.Bottle({
    brandId: brand.id,
    statedAge: null,
    name: "Nice Oak",
    vintageYear: null,
    releaseYear: null,
    edition: null,
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  await caller.bottleUpdate({
    bottle: bottle.id,
    name: "Delicious 10",
    statedAge: 10,
  });

  const [bottle2] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));

  expect(bottle2.statedAge).toBe(10);
  expect(bottle2.name).toBe("Delicious 10-year-old");
  expect(bottle2.fullName).toBe(`${brand.name} ${bottle2.name}`);
});

test("fills in statedAge", async ({ fixtures }) => {
  const brand = await fixtures.Entity();
  const bottle = await fixtures.Bottle({
    brandId: brand.id,
    statedAge: null,
    name: "Delicious",
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  await caller.bottleUpdate({
    bottle: bottle.id,
    name: "Delicious 10-year-old",
  });

  const [bottle2] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));

  expect(bottle2.statedAge).toBe(10);
});

test("removes statedAge", async ({ fixtures }) => {
  const bottle = await fixtures.Bottle({ name: "Foo Bar", statedAge: 10 });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  await caller.bottleUpdate({
    bottle: bottle.id,
    statedAge: null,
  });

  const [bottle2] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));

  expect(bottle2.statedAge).toBeNull();
});

test("changes brand", async ({ fixtures }) => {
  const newBrand = await fixtures.Entity();
  const bottle = await fixtures.Bottle({
    name: "Nice Oak",
    vintageYear: null,
    releaseYear: null,
    edition: null,
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  await caller.bottleUpdate({
    bottle: bottle.id,
    brand: newBrand.id,
  });

  const [bottle2] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));

  expect(bottle2.brandId).toBe(newBrand.id);
  expect(bottle2.fullName).toBe(`${newBrand.name} ${bottle.name}`);
});

test("removes distiller", async ({ fixtures }) => {
  const distillerA = await fixtures.Entity();
  const distillerB = await fixtures.Entity();
  const bottle = await fixtures.Bottle({
    distillerIds: [distillerA.id, distillerB.id],
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  await caller.bottleUpdate({
    bottle: bottle.id,
    distillers: [distillerA.id],
  });

  const results = await db
    .select({
      distillerId: bottlesToDistillers.distillerId,
    })
    .from(bottlesToDistillers)
    .where(eq(bottlesToDistillers.bottleId, bottle.id));

  expect(results.length).toEqual(1);
  expect(results[0].distillerId).toEqual(distillerA.id);
});

test("changes distiller", async ({ fixtures }) => {
  const distillerA = await fixtures.Entity();
  const distillerB = await fixtures.Entity();
  const bottle = await fixtures.Bottle({
    distillerIds: [distillerA.id],
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  await caller.bottleUpdate({
    bottle: bottle.id,
    distillers: [distillerB.id],
  });
});

test("adds distiller", async ({ fixtures }) => {
  const distillerA = await fixtures.Entity();
  const bottle = await fixtures.Bottle({
    distillerIds: [],
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  await caller.bottleUpdate({
    bottle: bottle.id,
    distillers: [distillerA.id],
  });

  const distillers = await db
    .select({ distiller: entities })
    .from(entities)
    .innerJoin(
      bottlesToDistillers,
      eq(bottlesToDistillers.distillerId, entities.id),
    )
    .where(eq(bottlesToDistillers.bottleId, bottle.id));
  expect(distillers.length).toBe(1);
  const { distiller } = distillers[0];
  expect(distiller.id).toEqual(distillerA.id);
});

test("changes bottler", async ({ fixtures }) => {
  const bottlerA = await fixtures.Entity();
  const bottlerB = await fixtures.Entity();
  const bottle = await fixtures.Bottle({
    bottlerId: bottlerA.id,
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  await caller.bottleUpdate({
    bottle: bottle.id,
    bottler: bottlerB.id,
  });

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));
  expect(newBottle.bottlerId).toEqual(bottlerB.id);
});

test("changes distiller with previous identical brand", async ({
  fixtures,
}) => {
  const entityA = await fixtures.Entity();
  const entityB = await fixtures.Entity();
  const bottle = await fixtures.Bottle({
    brandId: entityA.id,
    distillerIds: [entityA.id],
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  await caller.bottleUpdate({
    bottle: bottle.id,
    brand: entityA.id,
    distillers: [entityB.id],
  });

  // TODO:
});

test("applies SMWS from bottle normalize", async ({ defaults, fixtures }) => {
  const brand = await fixtures.Entity({
    name: "The Scotch Malt Whisky Society",
  });
  const distiller = await fixtures.Entity({
    name: "Glenfarclas",
  });
  const bottle = await fixtures.Bottle({ brandId: brand.id });

  const caller = createCaller({ user: await fixtures.User({ mod: true }) });
  const data = await caller.bottleUpdate({
    bottle: bottle.id,
    name: "1.54",
    brand: brand.id,
  });

  expect(data.id).toBeDefined();

  const dList = await db
    .select()
    .from(bottlesToDistillers)
    .where(eq(bottlesToDistillers.bottleId, data.id));
  expect(dList.length).toEqual(1);
  expect(dList[0].distillerId).toEqual(distiller.id);
});

test("saves cask information", async ({ defaults, fixtures }) => {
  const bottle = await fixtures.Bottle();

  const caller = createCaller({ user: await fixtures.User({ mod: true }) });
  const data = await caller.bottleUpdate({
    bottle: bottle.id,
    caskType: "bourbon",
    caskSize: "hogshead",
    caskFill: "1st_fill",
  });

  expect(data.id).toBeDefined();

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));

  expect(newBottle.caskType).toEqual("bourbon");
  expect(newBottle.caskSize).toEqual("hogshead");
  expect(newBottle.caskFill).toEqual("1st_fill");
});

test("saves vintage information", async ({ defaults, fixtures }) => {
  const bottle = await fixtures.Bottle({
    name: "Delicious",
    statedAge: null,
    releaseYear: null,
  });

  const caller = createCaller({ user: await fixtures.User({ mod: true }) });
  const data = await caller.bottleUpdate({
    bottle: bottle.id,
    statedAge: null,
    vintageYear: 2023,
  });

  expect(data.id).toBeDefined();

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));

  expect(newBottle.vintageYear).toEqual(2023);
});

test("saves release year", async ({ defaults, fixtures }) => {
  const bottle = await fixtures.Bottle();

  const caller = createCaller({ user: await fixtures.User({ mod: true }) });
  const data = await caller.bottleUpdate({
    bottle: bottle.id,
    releaseYear: 2024,
  });

  expect(data.id).toBeDefined();

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));

  expect(newBottle.releaseYear).toEqual(2024);
});
