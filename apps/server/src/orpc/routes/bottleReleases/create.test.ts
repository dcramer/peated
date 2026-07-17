import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroups,
  bottleReleases,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  catalogTargets,
  changes,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@peated/server/worker/client", () => ({
  pushJob: vi.fn(),
  pushUniqueJob: vi.fn(),
}));

describe("POST /bottle-releases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("retains legacy authentication and accepted-terms requirements", async ({
    fixtures,
  }) => {
    const unauthenticated = await waitError(
      routerClient.bottleReleases.create(
        { bottle: 1, edition: "Unauthenticated" },
        { context: { user: null } },
      ),
    );
    expect(unauthenticated).toMatchObject({ status: 401 });

    const noTermsUser = await fixtures.User({ termsAcceptedAt: null });
    const noTerms = await waitError(
      routerClient.bottleReleases.create(
        { bottle: 1, edition: "No terms" },
        { context: { user: noTermsUser } },
      ),
    );
    expect(noTerms).toMatchObject({ status: 403 });

    const unverifiedUser = await fixtures.User({ verified: false });
    const source = await fixtures.Bottle({ name: "Unverified Source" });
    const result = await routerClient.bottleReleases.create(
      { bottle: source.id, edition: "Unverified caller allowed" },
      { context: { user: unverifiedUser } },
    );
    expect(result).toMatchObject({
      kind: "bottle",
      group: { id: source.groupId },
    });
  });

  test("creates and returns an independently complete exact Bottle in the source group", async ({
    defaults,
    fixtures,
  }) => {
    const currentYear = new Date().getFullYear();
    const brand = await fixtures.Entity({ name: "Compatibility Brand" });
    const bottler = await fixtures.Entity({
      name: "Compatibility Bottler",
      type: ["bottler"],
    });
    const distiller = await fixtures.Entity({
      name: "Compatibility Distiller",
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
      numReleases: 7,
    });
    const [sourceGroupBefore] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, source.groupId!));
    vi.clearAllMocks();

    const result = await routerClient.bottleReleases.create(
      {
        bottle: source.id,
        edition: "Batch Zero",
        statedAge: null,
        abv: 0,
        singleCask: false,
        caskStrength: false,
        vintageYear: 2012,
        releaseYear: currentYear,
        caskSize: "hogshead",
        caskType: "bourbon",
        caskFill: "refill",
        description: "Exact compatibility content",
        tastingNotes: {
          nose: "Smoke",
          palate: "Malt",
          finish: "Dry",
        },
        imageUrl: null,
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
        seriesId: series.id,
        category: "single_malt",
        flavorProfile: "peated",
        statedAge: 12,
        representativeBottleId: source.id,
        totalBottles: sourceGroupBefore.totalBottles + 1,
      },
      bottle: {
        id: expect.any(Number),
        groupId: source.groupId,
        brandId: brand.id,
        bottlerId: bottler.id,
        distillerIds: [distiller.id],
        seriesId: series.id,
        category: "single_malt",
        flavorProfile: "peated",
        edition: "Batch Zero",
        statedAge: 12,
        abv: 0,
        singleCask: false,
        caskStrength: false,
        vintageYear: 2012,
        releaseYear: currentYear,
        caskSize: "hogshead",
        caskType: "bourbon",
        caskFill: "refill",
        description: "Exact compatibility content",
        tastingNotes: {
          nose: "Smoke",
          palate: "Malt",
          finish: "Dry",
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
      name: result.bottle.name,
      fullName: result.bottle.fullName,
      brandId: brand.id,
      bottlerId: bottler.id,
      seriesId: series.id,
      category: "single_malt",
      flavorProfile: "peated",
      edition: "Batch Zero",
      statedAge: 12,
      abv: 0,
      singleCask: false,
      caskStrength: false,
      vintageYear: 2012,
      releaseYear: currentYear,
      caskSize: "hogshead",
      caskType: "bourbon",
      caskFill: "refill",
      description: "Exact compatibility content",
      descriptionSrc: "user",
      imageUrl: null,
      tastingNotes: {
        nose: "Smoke",
        palate: "Malt",
        finish: "Dry",
      },
    });
    expect(
      await db
        .select()
        .from(bottlesToDistillers)
        .where(eq(bottlesToDistillers.bottleId, result.bottle.id)),
    ).toEqual([
      expect.objectContaining({
        bottleId: result.bottle.id,
        distillerId: distiller.id,
      }),
    ]);

    expect(
      await db
        .select()
        .from(catalogTargets)
        .where(eq(catalogTargets.id, result.targetId)),
    ).toEqual([
      expect.objectContaining({
        id: result.targetId,
        groupId: source.groupId,
        bottleId: result.bottle.id,
      }),
    ]);
    expect(
      await db
        .select()
        .from(bottleAliases)
        .where(eq(bottleAliases.targetId, result.targetId)),
    ).toContainEqual(
      expect.objectContaining({
        bottleId: result.bottle.id,
        releaseId: null,
        targetId: result.targetId,
      }),
    );
    expect(await db.select().from(bottleReleases)).toHaveLength(0);

    expect(
      await db
        .select()
        .from(bottleGroups)
        .where(eq(bottleGroups.id, source.groupId!)),
    ).toEqual([
      expect.objectContaining({
        id: source.groupId,
        totalBottles: sourceGroupBefore.totalBottles + 1,
      }),
    ]);

    const [unchangedSource] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, source.id));
    expect(unchangedSource).toEqual(source);
    expect(unchangedSource.numReleases).toBe(7);

    expect(
      await db
        .select()
        .from(changes)
        .where(
          and(
            eq(changes.objectType, "bottle"),
            eq(changes.objectId, result.bottle.id),
          ),
        ),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(changes)
        .where(eq(changes.objectType, "bottle_release")),
    ).toHaveLength(0);

    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith("OnBottleChange", {
      bottleId: result.bottle.id,
    });
    expect(workerClient.pushJob).not.toHaveBeenCalledWith(
      "OnBottleReleaseChange",
      expect.anything(),
    );
  });

  test("rejects unsupported image URLs and canonical future years without writes", async ({
    defaults,
    fixtures,
  }) => {
    const currentYear = new Date().getFullYear();
    const source = await fixtures.Bottle({ name: "Validation Source" });
    const beforeBottles = await db.select().from(bottles);
    const beforeTargets = await db.select().from(catalogTargets);
    const beforeGroups = await db.select().from(bottleGroups);
    const beforeAliases = await db.select().from(bottleAliases);
    const beforeChanges = await db.select().from(changes);

    const imageError = await waitError(
      routerClient.bottleReleases.create(
        {
          bottle: source.id,
          edition: "Image attempt",
          imageUrl: "https://example.com/release.jpg",
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(imageError).toMatchObject({ status: 400 });

    const futureYearError = await waitError(
      routerClient.bottleReleases.create(
        {
          bottle: source.id,
          edition: "Future attempt",
          releaseYear: currentYear + 1,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(futureYearError).toMatchObject({ status: 400 });

    expect(await db.select().from(bottles)).toEqual(beforeBottles);
    expect(await db.select().from(catalogTargets)).toEqual(beforeTargets);
    expect(await db.select().from(bottleGroups)).toEqual(beforeGroups);
    expect(await db.select().from(bottleAliases)).toEqual(beforeAliases);
    expect(await db.select().from(changes)).toEqual(beforeChanges);
    expect(await db.select().from(bottleReleases)).toHaveLength(0);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });

  test("maps missing sources to not found and inactive graphs to conflict", async ({
    defaults,
    fixtures,
  }) => {
    const missing = await waitError(
      routerClient.bottleReleases.create(
        { bottle: 999_999, edition: "Missing" },
        { context: { user: defaults.user } },
      ),
    );
    expect(missing).toMatchObject({ status: 404 });

    const legacy = await fixtures.LegacyBottle({ name: "Invalid Graph" });
    const invalidGraph = await waitError(
      routerClient.bottleReleases.create(
        { bottle: legacy.id, edition: "Invalid" },
        { context: { user: defaults.user } },
      ),
    );
    expect(invalidGraph).toMatchObject({ status: 409 });

    const retired = await fixtures.Bottle({ name: "Retired Source" });
    const replacement = await fixtures.Bottle({ name: "Replacement Source" });
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });
    const retiredError = await waitError(
      routerClient.bottleReleases.create(
        { bottle: retired.id, edition: "Retired" },
        { context: { user: defaults.user } },
      ),
    );
    expect(retiredError).toMatchObject({ status: 409 });
    expect(await db.select().from(bottleReleases)).toHaveLength(0);
  });

  test("returns the duplicate Bottle and rolls back every attempted write", async ({
    defaults,
    fixtures,
  }) => {
    const currentYear = new Date().getFullYear();
    const source = await fixtures.Bottle({ name: "Duplicate Source" });
    const existing = await routerClient.bottles.createFromSource(
      {
        bottle: source.id,
        edition: "Batch 1",
        releaseYear: currentYear,
      },
      { context: { user: defaults.user } },
    );
    const beforeBottles = await db.select().from(bottles);
    const beforeTargets = await db.select().from(catalogTargets);
    const beforeAliases = await db.select().from(bottleAliases);
    const beforeChanges = await db.select().from(changes);
    const [groupBefore] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, source.groupId!));
    vi.clearAllMocks();

    const conflict = await waitError(
      routerClient.bottleReleases.create(
        {
          bottle: source.id,
          edition: "Batch 1",
          releaseYear: currentYear,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(conflict).toMatchObject({
      status: 409,
      data: { bottle: existing.bottle.id },
    });
    expect(await db.select().from(bottles)).toEqual(beforeBottles);
    expect(await db.select().from(catalogTargets)).toEqual(beforeTargets);
    expect(await db.select().from(bottleAliases)).toEqual(beforeAliases);
    expect(await db.select().from(changes)).toEqual(beforeChanges);
    expect(
      await db
        .select()
        .from(bottleGroups)
        .where(eq(bottleGroups.id, source.groupId!)),
    ).toEqual([groupBefore]);
    expect(await db.select().from(bottleReleases)).toHaveLength(0);
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
  });
});
