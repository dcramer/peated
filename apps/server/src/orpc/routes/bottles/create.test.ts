import type * as bottleClassifierModule from "@peated/server/agents/bottleClassifier";
import config from "@peated/server/config";
import { FLAVOR_PROFILES } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottleGroups,
  bottleReleases,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  catalogTargets,
  changes,
  entities,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import type * as catalogVerificationModule from "@peated/server/lib/catalogVerification";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { and, eq } from "drizzle-orm";
import { beforeEach, vi } from "vitest";

const queueBottleCreationVerificationMock = vi.hoisted(() => vi.fn());
const queueEntityCreationVerificationMock = vi.hoisted(() => vi.fn());
const classifyBottleReferenceMock = vi.hoisted(() => vi.fn());

vi.mock("@peated/server/worker/client", () => ({
  pushUniqueJob: vi.fn(),
}));

vi.mock("@peated/server/lib/catalogVerification", async () => {
  const actual = await vi.importActual<typeof catalogVerificationModule>(
    "@peated/server/lib/catalogVerification",
  );

  return {
    ...actual,
    queueBottleCreationVerification: queueBottleCreationVerificationMock,
    queueEntityCreationVerification: queueEntityCreationVerificationMock,
  };
});

vi.mock("@peated/server/agents/bottleClassifier", async () => {
  const actual = await vi.importActual<typeof bottleClassifierModule>(
    "@peated/server/agents/bottleClassifier",
  );

  return {
    ...actual,
    classifyBottleReference: classifyBottleReferenceMock,
  };
});

describe("POST /bottles", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    config.OPENAI_API_KEY = undefined;
  });

  test("requires authentication, verification, and accepted terms without writes", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity();
    const unverifiedUser = await fixtures.User({ verified: false });
    const noTermsUser = await fixtures.User({ termsAcceptedAt: null });
    const graphBefore = {
      bottles: await db.select().from(bottles),
      groups: await db.select().from(bottleGroups),
      targets: await db.select().from(catalogTargets),
    };
    const cases = [
      ["unauthenticated", null, 401],
      ["unverified", unverifiedUser, 401],
      ["terms not accepted", noTermsUser, 403],
    ] as const;

    for (const [label, user, status] of cases) {
      const error = await waitError(
        routerClient.bottles.create(
          {
            name: `Denied Bottle ${label}`,
            brand: brand.id,
          },
          { context: { user } },
        ),
      );
      expect(error, label).toMatchObject({ status });
    }

    expect(await db.select().from(bottles)).toEqual(graphBefore.bottles);
    expect(await db.select().from(bottleGroups)).toEqual(graphBefore.groups);
    expect(await db.select().from(catalogTargets)).toEqual(graphBefore.targets);
  });

  test("rejects invalid numeric fields at the route boundary", async ({
    fixtures,
    defaults,
  }) => {
    const brand = await fixtures.Entity();
    const cases = [
      ["fractional age", { statedAge: 12.5 }],
      ["fractional vintage year", { vintageYear: 2010.5 }],
      ["nonpositive brand id", { brand: 0 }],
      ["nonpositive bottler id", { bottler: -1 }],
      ["nonpositive distiller id", { distillers: [0] }],
      ["nonpositive series id", { series: 0 }],
    ] as const;

    for (const [label, invalid] of cases) {
      const input = {
        name: "Boundary Guard",
        brand: brand.id,
        ...invalid,
      } as Parameters<typeof routerClient.bottles.create>[0];
      const err = await waitError(
        routerClient.bottles.create(input, {
          context: { user: defaults.user },
        }),
      );

      expect(err.message, label).toBe("Input validation failed");
    }
    expect(await db.select().from(bottles)).toHaveLength(0);
  });

  test("rejects unsupported image input", async ({ fixtures, defaults }) => {
    const brand = await fixtures.Entity();
    const cases = [
      ["image", { image: null }],
      ["imageUrl", { imageUrl: "https://example.com/bottle.jpg" }],
    ] as const;

    for (const [label, unsupported] of cases) {
      const input = {
        name: "Unsupported Image Input",
        brand: brand.id,
        ...unsupported,
      } as Parameters<typeof routerClient.bottles.create>[0];
      const err = await waitError(
        routerClient.bottles.create(input, {
          context: { user: defaults.user },
        }),
      );

      expect(err.message, label).toBe("Input validation failed");
    }
    expect(await db.select().from(bottles)).toHaveLength(0);
  });

  test("persists and returns exact tasting notes", async ({
    fixtures,
    defaults,
  }) => {
    const brand = await fixtures.Entity();
    const tastingNotes = {
      nose: "Orange peel",
      palate: "Toasted malt",
      finish: "Dry oak",
    };
    const data = await routerClient.bottles.create(
      {
        name: "Tasting Notes Release",
        brand: brand.id,
        tastingNotes,
      },
      { context: { user: defaults.user } },
    );

    expect(data.bottle.tastingNotes).toEqual(tastingNotes);
    const [bottle] = await db
      .select({ tastingNotes: bottles.tastingNotes })
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottle.tastingNotes).toEqual(tastingNotes);
  });

  test("creates a new bottle with minimal params", async ({
    fixtures,
    defaults,
  }) => {
    const brand = await fixtures.Entity();
    const data = await routerClient.bottles.create(
      {
        name: "Delicious Wood",
        brand: brand.id,
      },
      { context: { user: defaults.user } },
    );

    expect(data).toMatchObject({
      schemaVersion: 1,
      kind: "bottle",
      targetId: expect.any(Number),
      group: {
        id: expect.any(Number),
        name: "Delicious Wood",
        brandId: brand.id,
        representativeBottleId: expect.any(Number),
        totalBottles: 1,
      },
      bottle: {
        id: expect.any(Number),
        groupId: expect.any(Number),
        name: "Delicious Wood",
      },
    });
    expect(data.bottle.groupId).toBe(data.group.id);
    expect(data.group.representativeBottleId).toBe(data.bottle.id);

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottle).toMatchObject({
      id: data.bottle.id,
      groupId: data.group.id,
      name: "Delicious Wood",
      fullName: `${brand.name} Delicious Wood`,
      brandId: brand.id,
      bottlerId: null,
      seriesId: null,
      category: null,
      flavorProfile: null,
      statedAge: null,
      edition: null,
      abv: null,
      vintageYear: null,
      releaseYear: null,
    });

    const [group] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, data.group.id));
    expect(group).toMatchObject({
      id: bottle.groupId,
      name: bottle.name,
      fullName: bottle.fullName,
      brandId: bottle.brandId,
      bottlerId: bottle.bottlerId,
      seriesId: bottle.seriesId,
      category: bottle.category,
      flavorProfile: bottle.flavorProfile,
      statedAge: bottle.statedAge,
      representativeBottleId: bottle.id,
      totalBottles: 1,
    });

    const targets = await db
      .select()
      .from(catalogTargets)
      .where(eq(catalogTargets.groupId, group.id));
    expect(targets).toHaveLength(2);
    expect(targets).toContainEqual(
      expect.objectContaining({ groupId: group.id, bottleId: null }),
    );
    expect(targets).toContainEqual(
      expect.objectContaining({
        id: data.targetId,
        groupId: group.id,
        bottleId: bottle.id,
      }),
    );
    expect(await db.select().from(bottleReleases)).toHaveLength(0);

    const distillers = await db
      .select()
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, bottle.id));
    expect(distillers.length).toBe(0);
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith("OnBottleChange", {
      targetId: data.targetId,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "OnBottleAliasChange",
      { name: bottle.fullName },
    );
    expect(queueBottleCreationVerificationMock).toHaveBeenCalledWith({
      bottleId: bottle.id,
      creationSource: "manual_entry",
    });
  });

  test("rejects a bottle name that duplicates its brand", async ({
    fixtures,
    defaults,
  }) => {
    const brand = await fixtures.Entity({ name: "Duplicate Guard Brand" });

    const err = await waitError(
      routerClient.bottles.create(
        {
          name: "duplicate guard brand",
          brand: brand.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(
      `[Error: Bottle name must identify an expression distinct from the brand.]`,
    );
  });

  test("creates a new bottle with all params", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity();
    const distiller = await fixtures.Entity();

    const data = await routerClient.bottles.create(
      {
        name: "Delicious Wood",
        brand: brand.id,
        bottler: distiller.id,
        distillers: [distiller.id],
        category: "single_malt",
        statedAge: 12,
        flavorProfile: FLAVOR_PROFILES[0],
        edition: "Batch 7",
        abv: 57.1,
        singleCask: true,
        caskStrength: true,
        vintageYear: 2010,
        releaseYear: 2024,
        caskSize: "hogshead",
        caskType: "bourbon",
        caskFill: "1st_fill",
        description: "A complete concrete release.",
        descriptionSrc: "user",
      },
      { context: { user: defaults.user } },
    );

    expect(data.bottle.id).toBeDefined();
    expect(data.group).toMatchObject({
      name: "Delicious Wood",
      brandId: brand.id,
      bottlerId: distiller.id,
      distillerIds: [distiller.id],
      category: "single_malt",
      statedAge: 12,
      flavorProfile: FLAVOR_PROFILES[0],
      representativeBottleId: data.bottle.id,
      totalBottles: 1,
    });

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottle).toMatchObject({
      groupId: data.group.id,
      name: "Delicious Wood - Batch 7 - 2024 Release - 2010 Vintage - 57.1% ABV - Single Cask - Cask Strength - Bourbon Cask - Hogshead - 1st Fill",
      brandId: brand.id,
      bottlerId: distiller.id,
      category: "single_malt",
      statedAge: 12,
      flavorProfile: FLAVOR_PROFILES[0],
      edition: "Batch 7",
      abv: 57.1,
      singleCask: true,
      caskStrength: true,
      vintageYear: 2010,
      releaseYear: 2024,
      caskSize: "hogshead",
      caskType: "bourbon",
      caskFill: "1st_fill",
      description: "A complete concrete release.",
      descriptionSrc: "user",
    });
    expect(data.bottle).toMatchObject({
      id: bottle.id,
      groupId: bottle.groupId,
      name: bottle.name,
      brandId: bottle.brandId,
      bottlerId: bottle.bottlerId,
      distillerIds: [distiller.id],
      category: bottle.category,
      seriesId: bottle.seriesId,
      flavorProfile: bottle.flavorProfile,
      edition: bottle.edition,
      statedAge: bottle.statedAge,
      abv: bottle.abv,
      singleCask: bottle.singleCask,
      caskStrength: bottle.caskStrength,
      vintageYear: bottle.vintageYear,
      releaseYear: bottle.releaseYear,
      caskSize: bottle.caskSize,
      caskType: bottle.caskType,
      caskFill: bottle.caskFill,
      description: bottle.description,
      descriptionSrc: bottle.descriptionSrc,
    });
    expect(bottle.createdByActorId).toBe(
      (await getUserActor(defaults.user)).id,
    );
    const distillers = await db
      .select({ distillerId: bottlesToDistillers.distillerId })
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, bottle.id));
    expect(distillers.length).toBe(1);
    expect(distillers[0].distillerId).toEqual(distiller.id);

    const changeList = await db
      .select({ change: changes })
      .from(changes)
      .where(eq(changes.actorId, (await getUserActor(defaults.user)).id));

    expect(changeList.length).toBe(1);
    expect(changeList[0].change.objectId).toBe(bottle.id);
  });

  test("does not create a new bottle with invalid brandId", async ({
    defaults,
  }) => {
    const err = await waitError(
      routerClient.bottles.create(
        {
          name: "Delicious Wood",
          brand: 5,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Entity not found [id: 5]]`);
  });

  test("creates a new bottle with existing brand name", async ({
    fixtures,
    defaults,
  }) => {
    const existingBrand = await fixtures.Entity();

    const data = await routerClient.bottles.create(
      {
        name: "Delicious Wood",
        brand: {
          name: existingBrand.name,
        },
      },
      { context: { user: defaults.user } },
    );

    expect(data.bottle.id).toBeDefined();

    const [{ bottle, brand }] = await db
      .select({ bottle: bottles, brand: entities })
      .from(bottles)
      .innerJoin(entities, eq(entities.id, bottles.brandId))
      .where(eq(bottles.id, data.bottle.id));

    expect(bottle.name).toEqual("Delicious Wood");
    expect(bottle.brandId).toEqual(existingBrand.id);

    // it should not create a change entry for the brand
    const changeList = await db
      .select({ change: changes })
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "entity"),
          eq(changes.actorId, (await getUserActor(defaults.user)).id),
        ),
      );

    expect(changeList.length).toBe(0);
  });

  test("creates a new bottle with new brand name", async ({
    defaults,
    fixtures,
  }) => {
    const country = await fixtures.Country({ name: "United States" });
    const region = await fixtures.Region({
      countryId: country.id,
      name: "Kentucky",
    });
    const data = await routerClient.bottles.create(
      {
        name: "Delicious Wood",
        brand: {
          id: null,
          name: "Hard Knox",
          country: country.id,
          region: region.id,
        },
      },
      { context: { user: defaults.user } },
    );

    expect(data.bottle.id).toBeDefined();

    const [{ bottle, brand }] = await db
      .select({ bottle: bottles, brand: entities })
      .from(bottles)
      .innerJoin(entities, eq(entities.id, bottles.brandId))
      .where(eq(bottles.id, data.bottle.id));

    expect(bottle.name).toEqual("Delicious Wood");
    expect(bottle.brandId).toBeDefined();
    expect(brand.name).toBe("Hard Knox");
    expect(brand.createdByActorId).toBe((await getUserActor(defaults.user)).id);
    expect(brand.countryId).toEqual(country.id);
    expect(brand.regionId).toEqual(region.id);
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith("OnEntityChange", {
      entityId: brand.id,
    });
    expect(queueEntityCreationVerificationMock).toHaveBeenCalledWith({
      entityId: brand.id,
      creationSource: "manual_entry",
    });

    // it should create a change entry for the brand
    const changeList = await db
      .select({ change: changes })
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "entity"),
          eq(changes.actorId, (await getUserActor(defaults.user)).id),
        ),
      );

    expect(changeList.length).toBe(1);
  });

  test("does not create a new bottle with invalid distillerId", async ({
    defaults,
  }) => {
    const err = await waitError(
      routerClient.bottles.create(
        {
          name: "Delicious Wood",
          brand: {
            name: "Hard Knox",
          },
          distillers: [500000],
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Entity not found [id: 500000]]`);
  });

  test("creates a new bottle with existing distiller name", async ({
    fixtures,
    defaults,
  }) => {
    const existingBrand = await fixtures.Entity();
    const existingDistiller = await fixtures.Entity();
    const data = await routerClient.bottles.create(
      {
        name: "Delicious Wood",
        brand: {
          name: existingBrand.name,
        },
        distillers: [
          {
            name: existingDistiller.name,
          },
        ],
      },
      { context: { user: defaults.user } },
    );

    expect(data.bottle.id).toBeDefined();

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottle.name).toEqual("Delicious Wood");

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
          eq(changes.actorId, (await getUserActor(defaults.user)).id),
        ),
      );

    expect(changeList.length).toBe(0);
  });

  test("creates a new bottle with new distiller name", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity();

    const data = await routerClient.bottles.create(
      {
        name: "Delicious Wood",
        brand: brand.id,
        distillers: [
          {
            name: "Hard Knox",
          },
        ],
      },
      { context: { user: defaults.user } },
    );

    expect(data.bottle.id).toBeDefined();

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottle.name).toEqual("Delicious Wood");

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
    expect(distiller.createdByActorId).toBe(
      (await getUserActor(defaults.user)).id,
    );

    // it should create a change entry for the distiller
    const changeList = await db
      .select({ change: changes })
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "entity"),
          eq(changes.actorId, (await getUserActor(defaults.user)).id),
        ),
      );
    expect(changeList.length).toBe(1);
  });

  test("creates a new bottle with new distiller name and brand name", async ({
    defaults,
  }) => {
    const data = await routerClient.bottles.create(
      {
        name: "Delicious Wood",
        brand: {
          name: "Rip Van",
        },
        distillers: [
          {
            name: "Hard Knox",
          },
        ],
      },
      { context: { user: defaults.user } },
    );

    expect(data.bottle.id).toBeDefined();

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottle.name).toEqual("Delicious Wood");

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
    expect(distiller.createdByActorId).toBe(
      (await getUserActor(defaults.user)).id,
    );

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
          eq(changes.actorId, (await getUserActor(defaults.user)).id),
        ),
      );
    expect(changeList.length).toBe(2);
  });

  test("creates a new bottle with new distiller name which is duplicated as brand name", async ({
    defaults,
  }) => {
    const data = await routerClient.bottles.create(
      {
        name: "Delicious Wood",
        brand: {
          name: "Hard Knox",
        },
        distillers: [
          {
            name: "Hard Knox",
          },
        ],
      },
      { context: { user: defaults.user } },
    );

    expect(data.bottle.id).toBeDefined();

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottle.name).toEqual("Delicious Wood");

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
    expect(distiller.createdByActorId).toBe(
      (await getUserActor(defaults.user)).id,
    );
    expect(distiller.id).toBe(bottle.brandId);

    // it should create a change entry for the brand and distiller
    const changeList = await db
      .select({ change: changes })
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "entity"),
          eq(changes.actorId, (await getUserActor(defaults.user)).id),
        ),
      );
    expect(changeList.length).toBe(1);
  });

  test("does not run the classifier synchronously for manual creates", async ({
    defaults,
    fixtures,
  }) => {
    config.OPENAI_API_KEY = "test-key";

    const brand = await fixtures.Entity({ name: "Yamazaki" });
    classifyBottleReferenceMock.mockRejectedValue(
      new Error("classifier should not run in the request path"),
    );

    const data = await routerClient.bottles.create(
      {
        name: "Yamazaki 12-year-old",
        brand: brand.id,
      },
      { context: { user: defaults.user } },
    );

    expect(data.bottle.id).toBeDefined();
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
    expect(queueBottleCreationVerificationMock).toHaveBeenCalledWith({
      bottleId: data.bottle.id,
      creationSource: "manual_entry",
    });
  });

  test("rejects exact duplicate bottle aliases without the classifier", async ({
    defaults,
    fixtures,
  }) => {
    config.OPENAI_API_KEY = "test-key";

    const brand = await fixtures.Entity({ name: "Yamazaki" });
    await fixtures.Bottle({
      brandId: brand.id,
      name: "12-year-old",
      statedAge: 12,
    });

    const err = await waitError(
      routerClient.bottles.create(
        {
          name: "Yamazaki 12-year-old",
          brand: brand.id,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Bottle already exists.]`);
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("rejects duplicate SMWS bottle codes without requiring the subtitle", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({
      type: ["brand", "bottler"],
      name: "SMWS Manual Guard Society",
      shortName: "SMWS",
    });
    await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      name: "35.331 Ultra hoggie",
      singleCask: true,
    });
    await fixtures.Bottle({
      brandId: brand.id,
      bottlerId: brand.id,
      name: "35.3310 False lead",
      singleCask: true,
    });
    const bottleCount = (await db.select({ id: bottles.id }).from(bottles))
      .length;

    const err = await waitError(
      routerClient.bottles.create(
        {
          name: "35.331",
          brand: brand.id,
          bottler: brand.id,
          singleCask: true,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err).toMatchInlineSnapshot(`[Error: Bottle already exists.]`);
    expect((await db.select({ id: bottles.id }).from(bottles)).length).toBe(
      bottleCount,
    );
    expect(classifyBottleReferenceMock).not.toHaveBeenCalled();
  });

  test("preserves marketed age wording without inferring structured statedAge", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity();
    const distiller = await fixtures.Entity();

    const data = await routerClient.bottles.create(
      {
        name: "Delicious Wood 12-year-old",
        brand: brand.id,
        distillers: [distiller.id],
      },
      { context: { user: defaults.user } },
    );
    expect(data.bottle).toMatchObject({
      name: "Delicious Wood 12-year-old",
      fullName: `${brand.name} Delicious Wood 12-year-old`,
      statedAge: null,
    });

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottle).toMatchObject({
      name: "Delicious Wood 12-year-old",
      fullName: `${brand.name} Delicious Wood 12-year-old`,
      statedAge: null,
    });
  });

  test("removes duplicated brand name", async ({ defaults, fixtures }) => {
    const brand = await fixtures.Entity({ name: "Delicious Wood" });
    const data = await routerClient.bottles.create(
      {
        name: "Delicious Wood Yum Yum",
        brand: brand.id,
      },
      { context: { user: defaults.user } },
    );

    expect(data.bottle.id).toBeDefined();

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));
    expect(bottle.name).toEqual("Yum Yum");
    expect(bottle.fullName).toEqual("Delicious Wood Yum Yum");
  });

  test("applies SMWS from bottle normalize", async ({ defaults, fixtures }) => {
    const brand = await fixtures.Entity({
      name: "The Scotch Malt Whisky Society",
    });
    const distiller = await fixtures.Entity({
      name: "Glenfarclas",
    });
    const data = await routerClient.bottles.create(
      {
        name: "1.54",
        brand: brand.id,
      },
      { context: { user: defaults.user } },
    );

    expect(data.bottle.id).toBeDefined();

    const dList = await db
      .select()
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, data.bottle.id));
    expect(dList.length).toEqual(1);
    expect(dList[0].distillerId).toEqual(distiller.id);
  });

  test("creates a bottle with an existing series", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity();
    const series = await fixtures.BottleSeries({ brandId: brand.id });

    const data = await routerClient.bottles.create(
      {
        name: "Old Whisky",
        brand: brand.id,
        series: series.id,
      },
      { context: { user: defaults.user } },
    );

    expect(data.bottle.id).toBeDefined();

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));

    expect(newBottle.seriesId).toEqual(series.id);

    // Verify numReleases was updated
    const [updatedSeries] = await db
      .select()
      .from(bottleSeries)
      .where(eq(bottleSeries.id, series.id));

    expect(updatedSeries.numReleases).toEqual(1);
  });

  test("creates a bottle with a new series", async ({ defaults, fixtures }) => {
    const brand = await fixtures.Entity();

    const data = await routerClient.bottles.create(
      {
        name: "Old Whisky",
        brand: brand.id,
        series: {
          name: "Limited Edition",
          description: "Special release series",
        },
      },
      { context: { user: defaults.user } },
    );

    expect(data.bottle.id).toBeDefined();

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, data.bottle.id));

    expect(newBottle.seriesId).toBeDefined();

    const [newSeries] = await db
      .select()
      .from(bottleSeries)
      .where(eq(bottleSeries.id, newBottle.seriesId!));

    expect(newSeries.name).toEqual("Limited Edition");
    expect(newSeries.description).toEqual("Special release series");
    expect(newSeries.brandId).toEqual(brand.id);
    expect(newSeries.numReleases).toEqual(1);
    expect(newSeries.createdByActorId).toEqual(
      (await getUserActor(defaults.user)).id,
    );

    // Verify change was recorded
    const [change] = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "bottle_series"),
          eq(changes.objectId, newSeries.id),
        ),
      );

    expect(change).toBeDefined();
    expect(change.type).toEqual("add");
    expect(change.displayName).toEqual(`${brand.name} Limited Edition`);
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "IndexBottleSeriesSearchVectors",
      { seriesId: newSeries.id },
    );
  });

  test("rejects invalid series ID", async ({ defaults, fixtures }) => {
    const brand = await fixtures.Entity();

    const err = await waitError(
      routerClient.bottles.create(
        {
          name: "Old Whisky",
          brand: brand.id,
          series: 999999,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Series not found.]`);
  });
});
