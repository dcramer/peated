import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  changes,
  entities,
} from "@peated/server/db/schema";
import { omit } from "@peated/server/lib/filter";
import waitError from "@peated/server/lib/test/waitError";
import { and, eq } from "drizzle-orm";
import { expect, test } from "vitest";
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
  const bottle = await fixtures.Bottle({
    name: "Cool Bottle",
    releaseYear: null,
    vintageYear: null,
    edition: null,
  });

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
    statedAge: null,
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
  const bottle = await fixtures.Bottle({
    name: "Foo Bar",
    statedAge: 10,
  });

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

test("saves ABV information", async ({ defaults, fixtures }) => {
  const bottle = await fixtures.Bottle();

  const caller = createCaller({ user: await fixtures.User({ mod: true }) });
  const data = await caller.bottleUpdate({
    bottle: bottle.id,
    abv: 43.0,
  });

  expect(data.id).toBeDefined();

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));

  expect(newBottle.abv).toEqual(43.0);
});

test("removes ABV information", async ({ defaults, fixtures }) => {
  const bottle = await fixtures.Bottle({ abv: 40.0 });

  const caller = createCaller({ user: await fixtures.User({ mod: true }) });
  const data = await caller.bottleUpdate({
    bottle: bottle.id,
    abv: null,
  });

  expect(data.id).toBeDefined();

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));

  expect(newBottle.abv).toBeNull();
});

test("rejects invalid ABV values", async ({ defaults, fixtures }) => {
  const bottle = await fixtures.Bottle();

  const caller = createCaller({ user: await fixtures.User({ mod: true }) });
  const err = await waitError(
    caller.bottleUpdate({
      bottle: bottle.id,
      abv: 101, // Invalid: above 100
    }),
  );
  expect(err).toMatchInlineSnapshot(`
    [TRPCError: [
      {
        "code": "too_big",
        "maximum": 100,
        "type": "number",
        "inclusive": true,
        "exact": false,
        "message": "Number must be less than or equal to 100",
        "path": [
          "abv"
        ]
      }
    ]]
  `);
});

test("updates associated bottle releases when name changes", async ({
  fixtures,
}) => {
  const brand = await fixtures.Entity();
  const bottle = await fixtures.Bottle({
    brandId: brand.id,
    name: "Original Name",
    statedAge: null,
  });

  // Create a few releases with different attributes
  const release1 = await fixtures.BottleRelease({
    bottleId: bottle.id,
    edition: "Batch 1",
    abv: 43.0,
    statedAge: 12,
    releaseYear: 2020,
    vintageYear: 2008,
  });

  const release2 = await fixtures.BottleRelease({
    bottleId: bottle.id,
    edition: "Limited Edition",
    abv: 46.0,
    statedAge: null,
    releaseYear: 2021,
    vintageYear: null,
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  // Update the bottle name
  await caller.bottleUpdate({
    bottle: bottle.id,
    name: "New Name",
  });

  // Verify the releases were updated
  const [updatedRelease1] = await db
    .select()
    .from(bottleReleases)
    .where(eq(bottleReleases.id, release1.id));

  const [updatedRelease2] = await db
    .select()
    .from(bottleReleases)
    .where(eq(bottleReleases.id, release2.id));

  // Check first release
  expect(updatedRelease1.name).toBe(
    "New Name - Batch 1 - 12-year-old - 2020 Release - 2008 Vintage - 43.0% ABV",
  );
  expect(updatedRelease1.fullName).toBe(
    `${brand.name} New Name - Batch 1 - 12-year-old - 2020 Release - 2008 Vintage - 43.0% ABV`,
  );

  // Check second release
  expect(updatedRelease2.name).toBe(
    "New Name - Limited Edition - 2021 Release - 46.0% ABV",
  );
  expect(updatedRelease2.fullName).toBe(
    `${brand.name} New Name - Limited Edition - 2021 Release - 46.0% ABV`,
  );
});

test("updates associated bottle releases when brand changes", async ({
  fixtures,
}) => {
  const oldBrand = await fixtures.Entity();
  const newBrand = await fixtures.Entity();
  const bottle = await fixtures.Bottle({
    brandId: oldBrand.id,
    name: "Test Bottle",
    statedAge: null,
  });

  // Create a release
  const release = await fixtures.BottleRelease({
    bottleId: bottle.id,
    edition: "Special Edition",
    abv: 45.0,
    statedAge: null,
    vintageYear: null,
    releaseYear: null,
  });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  // Update the bottle brand
  await caller.bottleUpdate({
    bottle: bottle.id,
    brand: newBrand.id,
  });

  // Verify the release was updated
  const [updatedRelease] = await db
    .select()
    .from(bottleReleases)
    .where(eq(bottleReleases.id, release.id));

  expect(updatedRelease.name).toBe("Test Bottle - Special Edition - 45.0% ABV");
  expect(updatedRelease.fullName).toBe(
    `${newBrand.name} Test Bottle - Special Edition - 45.0% ABV`,
  );
});

test("creates a new series when updating a bottle", async function ({
  fixtures,
}) {
  const brand = await fixtures.Entity({ name: "Ardbeg" });
  const bottle = await fixtures.Bottle({ brandId: brand.id });

  const user = await fixtures.User({ mod: true });

  const caller = createCaller({
    user,
  });

  const data = {
    bottle: bottle.id,
    name: "Supernova",
    series: {
      name: "Supernova",
    },
  };

  await caller.bottleUpdate(data);

  const [updatedBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));

  expect(updatedBottle.seriesId).toBeDefined();

  const [series] = await db
    .select()
    .from(bottleSeries)
    .where(eq(bottleSeries.id, updatedBottle.seriesId!));

  expect(series.name).toEqual(data.series.name);
  expect(series.brandId).toEqual(bottle.brandId);
  expect(series.numReleases).toEqual(1);

  // Verify change record was created
  const change = await db.query.changes.findFirst({
    where: and(
      eq(changes.objectId, series.id),
      eq(changes.objectType, "bottle_series"),
    ),
  });
  expect(change).toBeDefined();
  expect(change!.objectId).toEqual(series.id);
  expect(change!.objectType).toEqual("bottle_series");
  expect(change!.type).toEqual("add");
  expect(change!.createdById).toEqual(user.id);
  expect(change!.displayName).toEqual(`${brand.name} ${data.series.name}`);
  expect(change!.data).toEqual({
    name: data.series.name,
    fullName: `${brand.name} ${data.series.name}`,
    brandId: brand.id,
  });
});
