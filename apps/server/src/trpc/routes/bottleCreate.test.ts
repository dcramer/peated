import { FLAVOR_PROFILES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  bottlesToDistillers,
  changes,
  entities,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { and, eq, sql } from "drizzle-orm";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(
    caller.bottleCreate({
      expression: "Delicious Wood",
      brand: 1,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("creates a new bottle with minimal params", async ({
  fixtures,
  defaults,
}) => {
  const caller = createCaller({ user: defaults.user });
  const brand = await fixtures.Entity();
  const data = await caller.bottleCreate({
    expression: "Delicious Wood",
    brand: brand.id,
  });

  expect(data.id).toBeDefined();

  const [bottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));
  expect(bottle.expression).toEqual("Delicious Wood");
  expect(bottle.name).toEqual(bottle.expression);
  expect(bottle.brandId).toBeDefined();
  expect(bottle.statedAge).toBeNull();
  const distillers = await db
    .select()
    .from(bottlesToDistillers)
    .where(eq(bottlesToDistillers.bottleId, bottle.id));
  expect(distillers.length).toBe(0);
});

test("creates a new bottle with all params", async ({ defaults, fixtures }) => {
  const brand = await fixtures.Entity();
  const distiller = await fixtures.Entity();

  const caller = createCaller({ user: defaults.user });
  const data = await caller.bottleCreate({
    expression: "Delicious Wood",
    brand: brand.id,
    bottler: distiller.id,
    distillers: [distiller.id],
    statedAge: 12,
    flavorProfile: FLAVOR_PROFILES[0],
  });

  expect(data.id).toBeDefined();

  const [bottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));
  expect(bottle.expression).toEqual("Delicious Wood");
  expect(bottle.name).toEqual("Delicious Wood 12-year-old");
  expect(bottle.brandId).toEqual(brand.id);
  expect(bottle.statedAge).toEqual(12);
  expect(bottle.flavorProfile).toEqual(FLAVOR_PROFILES[0]);
  expect(bottle.createdById).toBe(defaults.user.id);
  const distillers = await db
    .select({ distillerId: bottlesToDistillers.distillerId })
    .from(bottlesToDistillers)
    .where(eq(bottlesToDistillers.bottleId, bottle.id));
  expect(distillers.length).toBe(1);
  expect(distillers[0].distillerId).toEqual(distiller.id);

  const changeList = await db
    .select({ change: changes })
    .from(changes)
    .where(eq(changes.createdById, defaults.user.id));

  expect(changeList.length).toBe(1);
  expect(changeList[0].change.objectId).toBe(bottle.id);
});

test("does not create a new bottle with invalid brandId", async ({
  defaults,
}) => {
  const caller = createCaller({ user: defaults.user });
  const err = await waitError(
    caller.bottleCreate({
      expression: "Delicious Wood",
      brand: 5,
    }),
  );

  expect(err).toMatchInlineSnapshot(`[TRPCError: Entity not found [id: 5]]`);
});

test("creates a new bottle with existing brand name", async ({
  fixtures,
  defaults,
}) => {
  const existingBrand = await fixtures.Entity();

  const caller = createCaller({ user: defaults.user });
  const data = await caller.bottleCreate({
    expression: "Delicious Wood",
    brand: {
      name: existingBrand.name,
    },
  });

  expect(data.id).toBeDefined();

  const [{ bottle, brand }] = await db
    .select({ bottle: bottles, brand: entities })
    .from(bottles)
    .innerJoin(entities, eq(entities.id, bottles.brandId))
    .where(eq(bottles.id, data.id));

  expect(bottle.expression).toEqual("Delicious Wood");
  expect(bottle.name).toEqual(bottle.expression);
  expect(bottle.brandId).toEqual(existingBrand.id);

  // it should not create a change entry for the brand
  const changeList = await db
    .select({ change: changes })
    .from(changes)
    .where(
      and(
        eq(changes.objectType, "entity"),
        eq(changes.createdById, defaults.user.id),
      ),
    );

  expect(changeList.length).toBe(0);
});

test("creates a new bottle with new brand name", async ({
  defaults,
  fixtures,
}) => {
  const caller = createCaller({ user: defaults.user });
  const country = await fixtures.Country({ name: "United States" });
  const region = await fixtures.Region({
    countryId: country.id,
    name: "Kentucky",
  });
  const data = await caller.bottleCreate({
    expression: "Delicious Wood",
    brand: {
      id: null,
      name: "Hard Knox",
      country: country.id,
      region: region.id,
    },
  });

  expect(data.id).toBeDefined();

  const [{ bottle, brand }] = await db
    .select({ bottle: bottles, brand: entities })
    .from(bottles)
    .innerJoin(entities, eq(entities.id, bottles.brandId))
    .where(eq(bottles.id, data.id));

  expect(bottle.expression).toEqual("Delicious Wood");
  expect(bottle.name).toEqual(bottle.expression);
  expect(bottle.brandId).toBeDefined();
  expect(brand.name).toBe("Hard Knox");
  expect(brand.createdById).toBe(defaults.user.id);
  expect(brand.countryId).toEqual(country.id);
  expect(brand.regionId).toEqual(region.id);

  // it should create a change entry for the brand
  const changeList = await db
    .select({ change: changes })
    .from(changes)
    .where(
      and(
        eq(changes.objectType, "entity"),
        eq(changes.createdById, defaults.user.id),
      ),
    );

  expect(changeList.length).toBe(1);
});

test("does not create a new bottle with invalid distillerId", async ({
  defaults,
}) => {
  const caller = createCaller({ user: defaults.user });
  const err = await waitError(
    caller.bottleCreate({
      expression: "Delicious Wood",
      brand: {
        name: "Hard Knox",
      },
      distillers: [500000],
    }),
  );
  expect(err).toMatchInlineSnapshot(
    `[TRPCError: Entity not found [id: 500000]]`,
  );
});

test("creates a new bottle with existing distiller name", async ({
  fixtures,
  defaults,
}) => {
  const existingBrand = await fixtures.Entity();
  const existingDistiller = await fixtures.Entity();
  const caller = createCaller({ user: defaults.user });
  const data = await caller.bottleCreate({
    expression: "Delicious Wood",
    brand: {
      name: existingBrand.name,
    },
    distillers: [
      {
        name: existingDistiller.name,
      },
    ],
  });

  expect(data.id).toBeDefined();

  const [bottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));
  expect(bottle.expression).toEqual("Delicious Wood");
  expect(bottle.name).toEqual(bottle.expression);

  const distillers = await db
    .select({ distiller: entities })
    .from(entities)
    .innerJoin(
      bottlesToDistillers,
      eq(bottlesToDistillers.distillerId, entities.id),
    )
    .where(eq(bottlesToDistillers.bottleId, bottle.id));

  expect(distillers.length).toEqual(1);
  expect(distillers[0].distiller.id).toEqual(existingDistiller.id);

  // it should not create a change entry for the brand
  const changeList = await db
    .select({ change: changes })
    .from(changes)
    .where(
      and(
        eq(changes.objectType, "entity"),
        eq(changes.createdById, defaults.user.id),
      ),
    );

  expect(changeList.length).toBe(0);
});

test("creates a new bottle with new distiller name", async ({
  defaults,
  fixtures,
}) => {
  const brand = await fixtures.Entity();

  const caller = createCaller({ user: defaults.user });
  const data = await caller.bottleCreate({
    expression: "Delicious Wood",
    brand: brand.id,
    distillers: [
      {
        name: "Hard Knox",
      },
    ],
  });

  expect(data.id).toBeDefined();

  const [bottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));
  expect(bottle.expression).toEqual("Delicious Wood");
  expect(bottle.name).toEqual(bottle.expression);

  const distillers = await db
    .select({ distiller: entities })
    .from(entities)
    .innerJoin(
      bottlesToDistillers,
      eq(bottlesToDistillers.distillerId, entities.id),
    )
    .where(eq(bottlesToDistillers.bottleId, bottle.id));

  expect(distillers.length).toEqual(1);
  const { distiller } = distillers[0];
  expect(distiller.id).toBeDefined();
  expect(distiller.name).toBe("Hard Knox");
  expect(distiller.createdById).toBe(defaults.user.id);

  // it should create a change entry for the distiller
  const changeList = await db
    .select({ change: changes })
    .from(changes)
    .where(
      and(
        eq(changes.objectType, "entity"),
        eq(changes.createdById, defaults.user.id),
      ),
    );
  expect(changeList.length).toBe(1);
});

test("creates a new bottle with new distiller name and brand name", async ({
  defaults,
}) => {
  const caller = createCaller({ user: defaults.user });
  const data = await caller.bottleCreate({
    expression: "Delicious Wood",
    brand: {
      name: "Rip Van",
    },
    distillers: [
      {
        name: "Hard Knox",
      },
    ],
  });

  expect(data.id).toBeDefined();

  const [bottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));
  expect(bottle.expression).toEqual("Delicious Wood");
  expect(bottle.name).toEqual(bottle.expression);

  const distillers = await db
    .select({ distiller: entities })
    .from(entities)
    .innerJoin(
      bottlesToDistillers,
      eq(bottlesToDistillers.distillerId, entities.id),
    )
    .where(eq(bottlesToDistillers.bottleId, bottle.id));

  expect(distillers.length).toEqual(1);
  const { distiller } = distillers[0];
  expect(distiller.id).toBeDefined();
  expect(distiller.name).toBe("Hard Knox");
  expect(distiller.createdById).toBe(defaults.user.id);

  const [brand] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, bottle.brandId));
  expect(brand.name).toBe("Rip Van");

  // it should create a change entry for the brand and distiller
  const changeList = await db
    .select({ change: changes })
    .from(changes)
    .where(
      and(
        eq(changes.objectType, "entity"),
        eq(changes.createdById, defaults.user.id),
      ),
    );
  expect(changeList.length).toBe(2);
});

test("creates a new bottle with new distiller name which is duplicated as brand name", async ({
  defaults,
}) => {
  const caller = createCaller({ user: defaults.user });
  const data = await caller.bottleCreate({
    expression: "Delicious Wood",
    brand: {
      name: "Hard Knox",
    },
    distillers: [
      {
        name: "Hard Knox",
      },
    ],
  });

  expect(data.id).toBeDefined();

  const [bottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));
  expect(bottle.expression).toEqual("Delicious Wood");
  expect(bottle.name).toEqual(bottle.expression);

  const distillers = await db
    .select({ distiller: entities })
    .from(entities)
    .innerJoin(
      bottlesToDistillers,
      eq(bottlesToDistillers.distillerId, entities.id),
    )
    .where(eq(bottlesToDistillers.bottleId, bottle.id));

  expect(distillers.length).toEqual(1);
  const { distiller } = distillers[0];
  expect(distiller.id).toEqual(bottle.brandId);
  expect(distiller.name).toBe("Hard Knox");
  expect(distiller.createdById).toBe(defaults.user.id);
  expect(distiller.id).toBe(bottle.brandId);

  // it should create a change entry for the brand and distiller
  const changeList = await db
    .select({ change: changes })
    .from(changes)
    .where(
      and(
        eq(changes.objectType, "entity"),
        eq(changes.createdById, defaults.user.id),
      ),
    );
  expect(changeList.length).toBe(1);
});

test("updates statedAge bottle w/ age signal", async ({
  defaults,
  fixtures,
}) => {
  const brand = await fixtures.Entity();
  const distiller = await fixtures.Entity();

  const caller = createCaller({ user: defaults.user });

  const data = await caller.bottleCreate({
    expression: "Delicious Wood 12-year-old",
    brand: brand.id,
    distillers: [distiller.id],
  });
  expect(data.id).toBeDefined();

  const [bottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));
  expect(bottle.statedAge).toEqual(12);
});

test("removes duplicated brand name", async ({ defaults, fixtures }) => {
  const brand = await fixtures.Entity({ name: "Delicious Wood" });
  const caller = createCaller({ user: defaults.user });
  const data = await caller.bottleCreate({
    expression: "Delicious Wood Yum Yum",
    brand: brand.id,
  });

  expect(data.id).toBeDefined();

  const [bottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));
  expect(bottle.expression).toEqual("Yum Yum");
  expect(bottle.name).toEqual(bottle.expression);
  expect(bottle.fullName).toEqual("Delicious Wood Yum Yum");
});

test("applies SMWS from bottle normalize", async ({ defaults, fixtures }) => {
  const brand = await fixtures.Entity({
    name: "The Scotch Malt Whisky Society",
  });
  const distiller = await fixtures.Entity({
    name: "Glenfarclas",
  });
  const caller = createCaller({ user: defaults.user });
  const data = await caller.bottleCreate({
    expression: "1.54",
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
  const brand = await fixtures.Entity();

  const caller = createCaller({ user: await fixtures.User({ mod: true }) });
  const data = await caller.bottleCreate({
    expression: "Old Whisky",
    brand: brand.id,
    caskType: "bourbon",
    caskSize: "hogshead",
    caskFill: "1st_fill",
  });

  expect(data.id).toBeDefined();

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));

  expect(newBottle.caskType).toEqual("bourbon");
  expect(newBottle.caskSize).toEqual("hogshead");
  expect(newBottle.caskFill).toEqual("1st_fill");
});

test("saves vintage information", async ({ defaults, fixtures }) => {
  const brand = await fixtures.Entity();

  const caller = createCaller({ user: await fixtures.User({ mod: true }) });
  const data = await caller.bottleCreate({
    expression: "Old Whisky",
    brand: brand.id,
    vintageYear: 2024,
  });

  expect(data.id).toBeDefined();

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));

  expect(newBottle.vintageYear).toEqual(2024);
});

test("saves release year", async ({ defaults, fixtures }) => {
  const brand = await fixtures.Entity();

  const caller = createCaller({ user: await fixtures.User({ mod: true }) });
  const data = await caller.bottleCreate({
    expression: "Old Whisky",
    brand: brand.id,
    releaseYear: 2024,
  });

  expect(data.id).toBeDefined();

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));

  expect(newBottle.releaseYear).toEqual(2024);
});

test("creating a new bottle with a new alias does not mess with unrelated aliases", async ({
  fixtures,
  defaults,
}) => {
  const otherAlias = await fixtures.BottleAlias({ name: "A", bottleId: null });

  const caller = createCaller({ user: defaults.user });
  const data = await caller.bottleCreate({
    expression: "Delicious Wood",
    brand: {
      name: "Cool Cats",
    },
  });

  expect(data.id).toBeDefined();

  const [{ bottle, brand }] = await db
    .select({ bottle: bottles, brand: entities })
    .from(bottles)
    .innerJoin(entities, eq(entities.id, bottles.brandId))
    .where(eq(bottles.id, data.id));

  expect(bottle.expression).toEqual("Delicious Wood");
  expect(bottle.name).toEqual(bottle.expression);

  const [newOtherAlias] = await db
    .select()
    .from(bottleAliases)
    .where(
      eq(sql`LOWER(${bottleAliases.name})`, otherAlias.name.toLowerCase()),
    );
  expect(newOtherAlias).toBeDefined();
  expect(newOtherAlias.bottleId).toEqual(otherAlias.bottleId);
});

test("saves ABV information", async ({ defaults, fixtures }) => {
  const brand = await fixtures.Entity();

  const caller = createCaller({ user: await fixtures.User({ mod: true }) });
  const data = await caller.bottleCreate({
    expression: "Old Whisky",
    brand: brand.id,
    abv: 40.5,
  });

  expect(data.id).toBeDefined();

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));

  expect(newBottle.abv).toEqual(40.5);
});

test("rejects invalid ABV values", async ({ defaults, fixtures }) => {
  const brand = await fixtures.Entity();

  const caller = createCaller({ user: await fixtures.User({ mod: true }) });
  const err = await waitError(
    caller.bottleCreate({
      expression: "Old Whisky",
      brand: brand.id,
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
