import { db } from "@peated/server/db";
import {
  bottleReleases,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  catalogTargets,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { vi } from "vitest";

vi.mock("@peated/server/worker/client", () => ({
  pushUniqueJob: vi.fn(),
}));

describe("POST /bottles/from/{bottle}", () => {
  test("requires authentication, verification, and accepted terms", async ({
    fixtures,
  }) => {
    const unauthenticated = await waitError(
      routerClient.bottles.createFromSource(
        { bottle: 1, edition: "Unauthenticated" },
        { context: { user: null } },
      ),
    );
    expect(unauthenticated).toMatchObject({ status: 401 });

    const unverifiedUser = await fixtures.User({ verified: false });
    const unverified = await waitError(
      routerClient.bottles.createFromSource(
        { bottle: 1, edition: "Unverified" },
        { context: { user: unverifiedUser } },
      ),
    );
    expect(unverified).toMatchObject({ status: 401 });

    const noTermsUser = await fixtures.User({ termsAcceptedAt: null });
    const noTerms = await waitError(
      routerClient.bottles.createFromSource(
        { bottle: 1, edition: "No terms" },
        { context: { user: noTermsUser } },
      ),
    );
    expect(noTerms).toMatchObject({ status: 403 });
  });

  test("creates an independently complete Bottle in the trusted source group", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Another Release Brand" });
    const bottler = await fixtures.Entity({
      name: "Another Release Bottler",
      type: ["bottler"],
    });
    const distiller = await fixtures.Entity({
      name: "Another Release Distiller",
    });
    const series = await fixtures.BottleSeries({ brandId: brand.id });
    const source = await fixtures.Bottle({
      name: "Annual Expression",
      brandId: brand.id,
      bottlerId: bottler.id,
      distillerIds: [distiller.id],
      seriesId: series.id,
      category: "single_malt",
      flavorProfile: "peated",
      statedAge: 12,
    });
    const expectedName = [
      "Annual Expression",
      "Batch 2",
      "13-year-old",
      "2026 Release",
      "2012 Vintage",
      "55.2% ABV",
      "Cask Strength",
      "Bourbon Cask",
      "Hogshead",
      "Refill",
    ].join(" - ");

    const result = await routerClient.bottles.createFromSource(
      {
        bottle: source.id,
        edition: "Batch 2",
        statedAge: 13,
        abv: 55.2,
        singleCask: false,
        caskStrength: true,
        vintageYear: 2012,
        releaseYear: 2026,
        caskSize: "hogshead",
        caskType: "bourbon",
        caskFill: "refill",
        description: "Second release editorial content",
        tastingNotes: {
          nose: "Lemon smoke",
          palate: "Malted barley",
          finish: "Dry peat",
        },
      },
      { context: { user: defaults.user } },
    );

    expect(result).toMatchObject({
      schemaVersion: 1,
      kind: "bottle",
      targetId: expect.any(Number),
      group: {
        id: source.groupId,
        name: "Annual Expression",
        brandId: brand.id,
        bottlerId: bottler.id,
        distillerIds: [distiller.id],
        category: "single_malt",
        seriesId: series.id,
        flavorProfile: "peated",
        statedAge: 12,
        representativeBottleId: source.id,
        totalBottles: 2,
      },
      bottle: {
        id: expect.any(Number),
        groupId: source.groupId,
        name: expectedName,
        brandId: brand.id,
        bottlerId: bottler.id,
        distillerIds: [distiller.id],
        category: "single_malt",
        seriesId: series.id,
        flavorProfile: "peated",
        edition: "Batch 2",
        statedAge: 13,
        abv: 55.2,
        singleCask: false,
        caskStrength: true,
        vintageYear: 2012,
        releaseYear: 2026,
        caskSize: "hogshead",
        caskType: "bourbon",
        caskFill: "refill",
        description: "Second release editorial content",
        tastingNotes: {
          nose: "Lemon smoke",
          palate: "Malted barley",
          finish: "Dry peat",
        },
      },
    });
    expect(result.bottle.id).not.toBe(source.id);

    const [createdBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, result.bottle.id));
    expect(createdBottle).toMatchObject({
      id: result.bottle.id,
      groupId: source.groupId,
      brandId: brand.id,
      bottlerId: bottler.id,
      seriesId: series.id,
      category: "single_malt",
      flavorProfile: "peated",
      edition: "Batch 2",
      statedAge: 13,
      releaseYear: 2026,
    });
    expect(
      await db
        .select()
        .from(bottlesToDistillers)
        .where(eq(bottlesToDistillers.bottleId, createdBottle.id)),
    ).toEqual([
      expect.objectContaining({
        bottleId: createdBottle.id,
        distillerId: distiller.id,
      }),
    ]);

    const groupTargets = await db
      .select()
      .from(catalogTargets)
      .where(eq(catalogTargets.groupId, source.groupId!));
    expect(groupTargets).toHaveLength(3);
    expect(groupTargets).toContainEqual(
      expect.objectContaining({
        id: result.targetId,
        bottleId: result.bottle.id,
        groupId: source.groupId,
      }),
    );
    expect(await db.select().from(bottleReleases)).toHaveLength(0);

    const [unchangedSource] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, source.id));
    expect(unchangedSource).toEqual(source);
  });

  test("rejects stable, group, and image authority at the route boundary", async ({
    defaults,
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ name: "Exact-only Source" });
    const beforeCount = (await db.select().from(bottles)).length;
    const forbiddenFields = [
      ["groupId", { groupId: source.groupId }],
      ["name", { name: "Different Stable Name" }],
      ["brand", { brand: source.brandId }],
      ["bottler", { bottler: null }],
      ["distillers", { distillers: [] }],
      ["series", { series: null }],
      ["category", { category: "single_malt" }],
      ["flavorProfile", { flavorProfile: "peated" }],
      ["image", { image: null }],
      ["imageUrl", { imageUrl: "https://example.com/bottle.jpg" }],
    ] as const;

    for (const [label, forbiddenField] of forbiddenFields) {
      const error = await waitError(
        routerClient.bottles.createFromSource(
          {
            bottle: source.id,
            edition: "Attempted Override",
            ...forbiddenField,
          } as Parameters<typeof routerClient.bottles.createFromSource>[0],
          { context: { user: defaults.user } },
        ),
      );

      expect(error.message, label).toBe("Input validation failed");
      expect((await db.select().from(bottles)).length, label).toBe(beforeCount);
    }

    expect(await db.select().from(bottleReleases)).toHaveLength(0);
  });

  test("maps missing sources to not found and inactive source graphs to conflict", async ({
    defaults,
    fixtures,
  }) => {
    const missing = await waitError(
      routerClient.bottles.createFromSource(
        { bottle: 999_999, edition: "Missing" },
        { context: { user: defaults.user } },
      ),
    );
    expect(missing).toMatchObject({ status: 404 });

    const retired = await fixtures.Bottle({ name: "Retired Source" });
    const replacement = await fixtures.Bottle({ name: "Replacement Source" });
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });
    const retiredError = await waitError(
      routerClient.bottles.createFromSource(
        { bottle: retired.id, edition: "Retired" },
        { context: { user: defaults.user } },
      ),
    );
    expect(retiredError).toMatchObject({ status: 409 });

    const legacy = await fixtures.LegacyBottle({ name: "Incomplete Source" });
    const incomplete = await waitError(
      routerClient.bottles.createFromSource(
        { bottle: legacy.id, edition: "Incomplete" },
        { context: { user: defaults.user } },
      ),
    );
    expect(incomplete).toMatchObject({ status: 409 });
  });

  test("returns a conflict for an existing exact Bottle identity", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Duplicate Release Brand" });
    const source = await routerClient.bottles.create(
      {
        name: "Annual Duplicate",
        brand: brand.id,
        edition: "2026 Release",
        releaseYear: 2026,
      },
      { context: { user: defaults.user } },
    );

    const conflict = await waitError(
      routerClient.bottles.createFromSource(
        {
          bottle: source.bottle.id,
          edition: "2026 Release",
          releaseYear: 2026,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(conflict).toMatchObject({ status: 409 });
    expect(
      await db
        .select()
        .from(bottles)
        .where(eq(bottles.groupId, source.group.id)),
    ).toHaveLength(1);
    expect(await db.select().from(bottleReleases)).toHaveLength(0);
  });
});
