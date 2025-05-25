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
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("PUT /bottles/:bottle", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.bottles.update({
        bottle: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod", async ({ defaults }) => {
    const err = await waitError(
      routerClient.bottles.update(
        {
          bottle: 1,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("bottle not found", async ({ fixtures }) => {
    const modUser = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.bottles.update(
        {
          bottle: 999999,
        },
        { context: { user: modUser } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });

  test("no changes", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({
      name: "Cool Bottle",
      releaseYear: null,
      vintageYear: null,
      edition: null,
    });
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
      },
      { context: { user: modUser } },
    );

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
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
        name: "Delicious Wood",
        statedAge: null,
      },
      { context: { user: modUser } },
    );

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
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
        category: null,
      },
      { context: { user: modUser } },
    );

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
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        name: "Delicious 10",
        statedAge: 10,
      },
      { context: { user: modUser } },
    );

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
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        name: "Delicious 10-year-old",
      },
      { context: { user: modUser } },
    );

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
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        statedAge: null,
      },
      { context: { user: modUser } },
    );

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
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        brand: newBrand.id,
      },
      { context: { user: modUser } },
    );

    const [bottle2] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(bottle2.brandId).toBe(newBrand.id);
    expect(bottle2.fullName).toBe(`${newBrand.name} ${bottle.name}`);
  });

  test("changes brand with new brand name", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({
      name: "Nice Oak",
    });
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        brand: {
          name: "New Brand Name",
        },
      },
      { context: { user: modUser } },
    );

    const [bottle2] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    const [newBrand] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, bottle2.brandId));

    expect(newBrand.name).toBe("New Brand Name");
    expect(newBrand.createdById).toBe(modUser.id);
    expect(bottle2.fullName).toBe(`${newBrand.name} ${bottle.name}`);

    // Verify change record was created for the new brand
    const brandChange = await db.query.changes.findFirst({
      where: and(
        eq(changes.objectId, newBrand.id),
        eq(changes.objectType, "entity"),
      ),
    });
    expect(brandChange).toBeDefined();
    expect(brandChange!.type).toEqual("add");
  });

  test("changes brand with existing brand name", async ({ fixtures }) => {
    const existingBrand = await fixtures.Entity();
    const bottle = await fixtures.Bottle({
      name: "Nice Oak",
    });
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        brand: {
          name: existingBrand.name,
        },
      },
      { context: { user: modUser } },
    );

    const [bottle2] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(bottle2.brandId).toBe(existingBrand.id);

    // Should not create a change record for existing brand
    const brandChanges = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectId, existingBrand.id),
          eq(changes.objectType, "entity"),
          eq(changes.createdById, modUser.id),
        ),
      );
    expect(brandChanges.length).toBe(0);
  });

  test("removes distiller", async ({ fixtures }) => {
    const distillerA = await fixtures.Entity();
    const distillerB = await fixtures.Entity();
    const bottle = await fixtures.Bottle({
      distillerIds: [distillerA.id, distillerB.id],
    });
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        distillers: [distillerA.id],
      },
      { context: { user: modUser } },
    );

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
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        distillers: [distillerB.id],
      },
      { context: { user: modUser } },
    );
  });

  test("adds distiller", async ({ fixtures }) => {
    const distillerA = await fixtures.Entity();
    const bottle = await fixtures.Bottle({
      distillerIds: [],
    });
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        distillers: [distillerA.id],
      },
      { context: { user: modUser } },
    );

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

  test("adds distiller with new distiller name", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({
      distillerIds: [],
    });
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        distillers: [
          {
            name: "New Distillery",
          },
        ],
      },
      { context: { user: modUser } },
    );

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
    expect(distiller.name).toBe("New Distillery");
    expect(distiller.createdById).toBe(modUser.id);

    // Verify change record was created for the new distiller
    const distillerChange = await db.query.changes.findFirst({
      where: and(
        eq(changes.objectId, distiller.id),
        eq(changes.objectType, "entity"),
      ),
    });
    expect(distillerChange).toBeDefined();
    expect(distillerChange!.type).toEqual("add");
  });

  test("adds distiller with existing distiller name", async ({ fixtures }) => {
    const existingDistiller = await fixtures.Entity();
    const bottle = await fixtures.Bottle({
      distillerIds: [],
    });
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        distillers: [
          {
            name: existingDistiller.name,
          },
        ],
      },
      { context: { user: modUser } },
    );

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
    expect(distiller.id).toEqual(existingDistiller.id);

    // Should not create a change record for existing distiller
    const distillerChanges = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectId, existingDistiller.id),
          eq(changes.objectType, "entity"),
          eq(changes.createdById, modUser.id),
        ),
      );
    expect(distillerChanges.length).toBe(0);
  });

  test("rejects invalid distiller ID", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const modUser = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.bottles.update(
        {
          bottle: bottle.id,
          distillers: [999999],
        },
        { context: { user: modUser } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Entity not found [id: 999999]]`);
  });

  test("changes bottler", async ({ fixtures }) => {
    const bottlerA = await fixtures.Entity();
    const bottlerB = await fixtures.Entity();
    const bottle = await fixtures.Bottle({
      bottlerId: bottlerA.id,
    });
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        bottler: bottlerB.id,
      },
      { context: { user: modUser } },
    );

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(newBottle.bottlerId).toEqual(bottlerB.id);
  });

  test("changes bottler with new bottler name", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        bottler: {
          name: "New Bottler",
        },
      },
      { context: { user: modUser } },
    );

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    const [bottler] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, newBottle.bottlerId!));

    expect(bottler.name).toBe("New Bottler");
    expect(bottler.createdById).toBe(modUser.id);

    // Verify change record was created for the new bottler
    const bottlerChange = await db.query.changes.findFirst({
      where: and(
        eq(changes.objectId, bottler.id),
        eq(changes.objectType, "entity"),
      ),
    });
    expect(bottlerChange).toBeDefined();
    expect(bottlerChange!.type).toEqual("add");
  });

  test("changes bottler with existing bottler name", async ({ fixtures }) => {
    const existingBottler = await fixtures.Entity();
    const bottle = await fixtures.Bottle();
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        bottler: {
          name: existingBottler.name,
        },
      },
      { context: { user: modUser } },
    );

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(newBottle.bottlerId).toEqual(existingBottler.id);

    // Should not create a change record for existing bottler
    const bottlerChanges = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectId, existingBottler.id),
          eq(changes.objectType, "entity"),
          eq(changes.createdById, modUser.id),
        ),
      );
    expect(bottlerChanges.length).toBe(0);
  });

  test("rejects invalid bottler ID", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const modUser = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.bottles.update(
        {
          bottle: bottle.id,
          bottler: 999999,
        },
        { context: { user: modUser } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Entity not found [id: 999999]]`);
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
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        brand: entityA.id,
        distillers: [entityB.id],
      },
      { context: { user: modUser } },
    );

    // TODO:
  });

  test("applies SMWS from bottle normalize", async ({ fixtures }) => {
    const brand = await fixtures.Entity({
      name: "The Scotch Malt Whisky Society",
    });
    const distiller = await fixtures.Entity({
      name: "Glenfarclas",
    });
    const bottle = await fixtures.Bottle({ brandId: brand.id });
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
        name: "1.54",
        brand: brand.id,
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();

    const dList = await db
      .select()
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, data.id));
    expect(dList.length).toEqual(1);
    expect(dList[0].distillerId).toEqual(distiller.id);
  });

  test("saves cask information", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
        caskType: "bourbon",
        caskSize: "hogshead",
        caskFill: "1st_fill",
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(newBottle.caskType).toEqual("bourbon");
    expect(newBottle.caskSize).toEqual("hogshead");
    expect(newBottle.caskFill).toEqual("1st_fill");
  });

  test("saves vintage information", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({
      name: "Delicious",
      statedAge: null,
      releaseYear: null,
    });
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
        statedAge: null,
        vintageYear: 2023,
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(newBottle.vintageYear).toEqual(2023);
  });

  test("saves release year", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
        releaseYear: 2024,
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(newBottle.releaseYear).toEqual(2024);
  });

  test("saves ABV information", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
        abv: 43.0,
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(newBottle.abv).toEqual(43.0);
  });

  test("removes ABV information", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ abv: 40.0 });
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
        abv: null,
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(newBottle.abv).toBeNull();
  });

  test("rejects invalid ABV values", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const modUser = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.bottles.update(
        {
          bottle: bottle.id,
          abv: 101, // Invalid: above 100
        },
        { context: { user: modUser } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("saves flavor profile", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
        flavorProfile: "peated",
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(newBottle.flavorProfile).toEqual("peated");
  });

  test("removes flavor profile", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({ flavorProfile: "peated" });
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
        flavorProfile: null,
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(newBottle.flavorProfile).toBeNull();
  });

  test("saves description and descriptionSrc", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
        description: "A wonderful whisky with complex flavors.",
        descriptionSrc: "user",
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(newBottle.description).toEqual(
      "A wonderful whisky with complex flavors.",
    );
    expect(newBottle.descriptionSrc).toEqual("user");
  });

  test("updates description without descriptionSrc", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
        description: "A wonderful whisky with complex flavors.",
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(newBottle.description).toEqual(
      "A wonderful whisky with complex flavors.",
    );
    expect(newBottle.descriptionSrc).toEqual("user");
  });

  test("clears description", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({
      description: "Old description",
      descriptionSrc: "user",
    });
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
        description: null,
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(newBottle.description).toBeNull();
    expect(newBottle.descriptionSrc).toBeNull();
  });

  test("removes image as mod", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({
      imageUrl: "https://example.com/image.jpg",
    });
    const modUser = await fixtures.User({ mod: true });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
        image: null,
      },
      { context: { user: modUser } },
    );

    expect(data.id).toBeDefined();

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(newBottle.imageUrl).toBeNull();
  });

  test("removes image as admin", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle({
      imageUrl: "https://example.com/image.jpg",
    });
    const adminUser = await fixtures.User({ admin: true });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
        image: null,
      },
      { context: { user: adminUser } },
    );

    expect(data.id).toBeDefined();

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(newBottle.imageUrl).toBeNull();
  });

  test("removes image as creator", async ({ fixtures }) => {
    const creator = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      imageUrl: "https://example.com/image.jpg",
      createdById: creator.id,
    });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
        image: null,
      },
      { context: { user: creator } },
    );

    expect(data.id).toBeDefined();

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(newBottle.imageUrl).toBeNull();
  });

  test("removes image as mod (different from creator)", async ({
    fixtures,
  }) => {
    const creator = await fixtures.User({ mod: true });
    const otherMod = await fixtures.User({ mod: true }); // Different mod user
    const bottle = await fixtures.Bottle({
      imageUrl: "https://example.com/image.jpg",
      createdById: creator.id,
    });

    const data = await routerClient.bottles.update(
      {
        bottle: bottle.id,
        image: null,
      },
      { context: { user: otherMod } },
    );

    expect(data.id).toBeDefined();

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    // Since otherMod is a mod, they can remove images
    // The logic is: admin || mod || creator can remove images
    expect(newBottle.imageUrl).toBeNull();
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
    const modUser = await fixtures.User({ mod: true });

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

    // Update the bottle name
    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        name: "New Name",
      },
      { context: { user: modUser } },
    );

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
    const modUser = await fixtures.User({ mod: true });

    // Create a release
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Special Edition",
      abv: 45.0,
      statedAge: null,
      vintageYear: null,
      releaseYear: null,
    });

    // Update the bottle brand
    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        brand: newBrand.id,
      },
      { context: { user: modUser } },
    );

    // Verify the release was updated
    const [updatedRelease] = await db
      .select()
      .from(bottleReleases)
      .where(eq(bottleReleases.id, release.id));

    expect(updatedRelease.name).toBe(
      "Test Bottle - Special Edition - 45.0% ABV",
    );
    expect(updatedRelease.fullName).toBe(
      `${newBrand.name} Test Bottle - Special Edition - 45.0% ABV`,
    );
  });

  test("creates a new series when updating a bottle", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "Ardbeg" });
    const bottle = await fixtures.Bottle({ brandId: brand.id });
    const modUser = await fixtures.User({ mod: true });

    const data = {
      bottle: bottle.id,
      name: "Supernova",
      series: {
        name: "Supernova",
      },
    };

    await routerClient.bottles.update(data, { context: { user: modUser } });

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
    expect(change!.createdById).toEqual(modUser.id);
    expect(change!.displayName).toEqual(`${brand.name} ${data.series.name}`);
    expect(change!.data).toEqual({
      name: data.series.name,
      fullName: `${brand.name} ${data.series.name}`,
      brandId: brand.id,
    });
  });

  test("updates bottle with existing series ID", async ({ fixtures }) => {
    const brand = await fixtures.Entity();
    const series = await fixtures.BottleSeries({ brandId: brand.id });
    const bottle = await fixtures.Bottle({ brandId: brand.id });
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        series: series.id,
      },
      { context: { user: modUser } },
    );

    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(updatedBottle.seriesId).toEqual(series.id);

    // Verify numReleases was incremented
    const [updatedSeries] = await db
      .select()
      .from(bottleSeries)
      .where(eq(bottleSeries.id, series.id));

    expect(updatedSeries.numReleases).toEqual(1);
  });

  test("rejects invalid series ID", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    const modUser = await fixtures.User({ mod: true });

    const err = await waitError(
      routerClient.bottles.update(
        {
          bottle: bottle.id,
          series: 999999,
        },
        { context: { user: modUser } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Series not found.]`);
  });

  test("removes brand name duplication from bottle name", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Delicious Wood" });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Original Name",
    });
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        name: "Delicious Wood Yum Yum",
      },
      { context: { user: modUser } },
    );

    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(updatedBottle.name).toEqual("Yum Yum");
    expect(updatedBottle.fullName).toEqual("Delicious Wood Yum Yum");
  });

  test("updates multiple fields simultaneously", async ({ fixtures }) => {
    const brand = await fixtures.Entity();
    const newBrand = await fixtures.Entity();
    const distiller = await fixtures.Entity();
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Original Name",
      statedAge: null,
      abv: null,
      flavorProfile: null,
    });
    const modUser = await fixtures.User({ mod: true });

    await routerClient.bottles.update(
      {
        bottle: bottle.id,
        name: "New Name",
        brand: newBrand.id,
        statedAge: 12,
        abv: 43.0,
        flavorProfile: "peated",
        distillers: [distiller.id],
        description: "A complex whisky",
        caskType: "bourbon",
        vintageYear: 2010,
        releaseYear: 2022,
      },
      { context: { user: modUser } },
    );

    const [updatedBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));

    expect(updatedBottle.name).toEqual("New Name");
    expect(updatedBottle.brandId).toEqual(newBrand.id);
    expect(updatedBottle.statedAge).toEqual(12);
    expect(updatedBottle.abv).toEqual(43.0);
    expect(updatedBottle.flavorProfile).toEqual("peated");
    expect(updatedBottle.description).toEqual("A complex whisky");
    expect(updatedBottle.caskType).toEqual("bourbon");
    expect(updatedBottle.vintageYear).toEqual(2010);
    expect(updatedBottle.releaseYear).toEqual(2022);

    // Verify distiller was added
    const distillers = await db
      .select()
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, bottle.id));
    expect(distillers.length).toBe(1);
    expect(distillers[0].distillerId).toEqual(distiller.id);
  });
});
