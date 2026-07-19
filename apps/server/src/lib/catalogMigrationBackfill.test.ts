import { getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import { asc, count, eq, inArray, sql } from "drizzle-orm";
import type { AnyPgTable } from "drizzle-orm/pg-core";
import { db } from "../db";
import {
  bottleAliases,
  bottleFlavorProfiles,
  bottleGroupDistillers,
  bottleGroups,
  bottleReleasePromotions,
  bottles,
  bottlesToDistillers,
  bottleTags,
  catalogTargets,
} from "../db/schema";
import {
  backfillLegacyCatalogBatch,
  backfillLegacyCatalogParent,
  CatalogMigrationBackfillError,
} from "./catalogMigrationBackfill";

async function tableCount(table: AnyPgTable) {
  const [result] = await db.select({ value: count() }).from(table);
  return result?.value ?? 0;
}

async function loadBottleRows(bottleIds: number[]) {
  return await db
    .select()
    .from(bottles)
    .where(inArray(bottles.id, bottleIds))
    .orderBy(asc(bottles.id));
}

async function expectBackfillError(
  promise: Promise<unknown>,
  code: CatalogMigrationBackfillError["code"],
) {
  const error = await waitError(promise);
  expect(error).toBeInstanceOf(CatalogMigrationBackfillError);
  expect(error).toMatchObject({ code });
  return error as CatalogMigrationBackfillError;
}

async function expectParentUnchanged(parentId: number) {
  const [parent] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, parentId));
  expect(parent?.groupId).toBeNull();
  expect(
    await db
      .select()
      .from(catalogTargets)
      .where(eq(catalogTargets.bottleId, parentId)),
  ).toEqual([]);
}

describe("legacy catalog migration backfill", () => {
  test.each([0, -1, 1.5, 1_001])(
    "rejects invalid batch limit %s",
    async (limit) => {
      const error = await expectBackfillError(
        backfillLegacyCatalogBatch({ limit }),
        "invalid_limit",
      );
      expect(error.details).toEqual({ limit });
    },
  );

  test("retains a zero-release Bottle id in a complete singleton graph", async ({
    fixtures,
  }) => {
    const firstDistiller = await fixtures.Entity();
    const secondDistiller = await fixtures.Entity();
    const parent = await fixtures.LegacyBottle({
      name: "Singleton Legacy Expression",
      fullName: "Singleton Brand Singleton Legacy Expression",
      distillerIds: [secondDistiller.id, firstDistiller.id],
    });

    const created = await backfillLegacyCatalogParent(parent.id);

    expect(created).toMatchObject({
      parentId: parent.id,
      releaseCount: 0,
      retainedBottleId: parent.id,
      representativeBottleId: parent.id,
      promoted: [],
      outcome: "created",
    });
    const [retained] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, parent.id));
    expect(retained).toMatchObject({ id: parent.id, groupId: created.groupId });

    const [group] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, created.groupId));
    expect(group).toMatchObject({
      representativeBottleId: parent.id,
      totalBottles: 1,
    });
    expect(
      await db
        .select({ bottleId: catalogTargets.bottleId })
        .from(catalogTargets)
        .where(eq(catalogTargets.groupId, created.groupId))
        .orderBy(asc(catalogTargets.bottleId)),
    ).toEqual([{ bottleId: parent.id }, { bottleId: null }]);
    expect(
      await db
        .select({ distillerId: bottleGroupDistillers.distillerId })
        .from(bottleGroupDistillers)
        .where(eq(bottleGroupDistillers.groupId, created.groupId))
        .orderBy(asc(bottleGroupDistillers.distillerId)),
    ).toEqual(
      [firstDistiller.id, secondDistiller.id]
        .sort((left, right) => left - right)
        .map((distillerId) => ({ distillerId })),
    );

    const rerun = await backfillLegacyCatalogParent(parent.id);
    expect(rerun).toEqual({ ...created, outcome: "reused" });
  });

  test("promotes releases into independently complete Bottles in one family", async ({
    fixtures,
  }) => {
    const bottler = await fixtures.Entity({ type: ["bottler"] });
    const firstDistiller = await fixtures.Entity({ type: ["distiller"] });
    const secondDistiller = await fixtures.Entity({ type: ["distiller"] });
    const series = await fixtures.BottleSeries();
    const parent = await fixtures.LegacyBottle({
      name: "Legacy Family",
      fullName: "Legacy Brand Legacy Family",
      statedAge: 12,
      seriesId: series.id,
      category: "single_malt",
      bottlerId: bottler.id,
      flavorProfile: "peated",
      description: "Parent editorial description",
      descriptionSrc: "user",
      imageUrl: "https://peated.test/parent.jpg",
      tastingNotes: {
        nose: "Parent nose",
        palate: "Parent palate",
        finish: "Parent finish",
      },
      suggestedTags: ["parent", "smoke"],
      distillerIds: [secondDistiller.id, firstDistiller.id],
    });
    await db.insert(bottleTags).values([
      { bottleId: parent.id, tag: "fruit", count: 3 },
      { bottleId: parent.id, tag: "smoke", count: 7 },
    ]);
    await db.insert(bottleFlavorProfiles).values([
      {
        bottleId: parent.id,
        flavorProfile: "sweet_fruit_mellow",
        count: 4,
      },
      { bottleId: parent.id, flavorProfile: "peated", count: 9 },
    ]);

    const firstCreator = await getUserActor(await fixtures.User());
    const secondCreator = await getUserActor(await fixtures.User());
    const firstCreatedAt = new Date("2020-01-02T03:04:05.000Z");
    const firstUpdatedAt = new Date("2021-02-03T04:05:06.000Z");
    const firstRelease = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Legacy Family Batch One",
      fullName: "Legacy Brand Legacy Family Batch One",
      edition: "Batch One",
      vintageYear: 2008,
      releaseYear: 2020,
      statedAge: null,
      abv: 54.2,
      singleCask: false,
      caskStrength: true,
      caskSize: "hogshead",
      caskType: "bourbon",
      caskFill: "1st_fill",
      description: null,
      descriptionSrc: null,
      imageUrl: "   ",
      tastingNotes: null,
      suggestedTags: [],
      createdAt: firstCreatedAt,
      updatedAt: firstUpdatedAt,
      createdByActorId: firstCreator.id,
    });
    const secondCreatedAt = new Date("2022-03-04T05:06:07.000Z");
    const secondUpdatedAt = new Date("2023-04-05T06:07:08.000Z");
    const secondRelease = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Legacy Family Batch Two",
      fullName: "Legacy Brand Legacy Family Batch Two",
      edition: "Batch Two",
      vintageYear: 2009,
      releaseYear: 2022,
      statedAge: 13,
      abv: 55.1,
      singleCask: true,
      caskStrength: true,
      caskSize: "barrel",
      caskType: "oloroso",
      caskFill: "refill",
      description: "Release editorial description",
      descriptionSrc: "user",
      imageUrl: "https://peated.test/release.jpg",
      tastingNotes: {
        nose: "Release nose",
        palate: "Release palate",
        finish: "Release finish",
      },
      suggestedTags: ["release"],
      createdAt: secondCreatedAt,
      updatedAt: secondUpdatedAt,
      createdByActorId: secondCreator.id,
    });

    const result = await backfillLegacyCatalogParent(parent.id);

    expect(result).toMatchObject({
      parentId: parent.id,
      releaseCount: 2,
      retainedBottleId: null,
      outcome: "created",
    });
    expect(result.promoted.map(({ releaseId }) => releaseId)).toEqual([
      firstRelease.id,
      secondRelease.id,
    ]);
    expect(result.representativeBottleId).toBe(result.promoted[0]?.bottleId);

    const [stagedParent] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, parent.id));
    expect(stagedParent?.groupId).toBe(result.groupId);
    expect(
      await db
        .select()
        .from(catalogTargets)
        .where(eq(catalogTargets.bottleId, parent.id)),
    ).toEqual([]);

    const [group] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, result.groupId));
    expect(group).toMatchObject({
      name: parent.name,
      fullName: parent.fullName,
      statedAge: 12,
      seriesId: series.id,
      category: "single_malt",
      brandId: parent.brandId,
      bottlerId: bottler.id,
      flavorProfile: "peated",
      description: "Parent editorial description",
      imageUrl: "https://peated.test/parent.jpg",
      suggestedTags: ["parent", "smoke"],
      representativeBottleId: result.promoted[0]?.bottleId,
      totalBottles: 2,
    });
    expect(
      await db
        .select({ distillerId: bottleGroupDistillers.distillerId })
        .from(bottleGroupDistillers)
        .where(eq(bottleGroupDistillers.groupId, result.groupId))
        .orderBy(asc(bottleGroupDistillers.distillerId)),
    ).toEqual(
      [firstDistiller.id, secondDistiller.id]
        .sort((left, right) => left - right)
        .map((distillerId) => ({ distillerId })),
    );
    expect(
      await db
        .select({ bottleId: catalogTargets.bottleId })
        .from(catalogTargets)
        .where(eq(catalogTargets.groupId, result.groupId))
        .orderBy(asc(catalogTargets.bottleId)),
    ).toEqual([
      ...result.promoted
        .map(({ bottleId }) => bottleId)
        .sort((left, right) => left - right)
        .map((bottleId) => ({ bottleId })),
      { bottleId: null },
    ]);

    const promotedBottles = await loadBottleRows(
      result.promoted.map(({ bottleId }) => bottleId),
    );
    const promotedByReleaseId = new Map(
      result.promoted.map((promotion) => [
        promotion.releaseId,
        promotedBottles.find(({ id }) => id === promotion.bottleId)!,
      ]),
    );
    expect(promotedByReleaseId.get(firstRelease.id)).toMatchObject({
      groupId: result.groupId,
      name: firstRelease.name,
      fullName: firstRelease.fullName,
      statedAge: parent.statedAge,
      seriesId: parent.seriesId,
      category: parent.category,
      brandId: parent.brandId,
      bottlerId: parent.bottlerId,
      flavorProfile: parent.flavorProfile,
      edition: firstRelease.edition,
      vintageYear: firstRelease.vintageYear,
      releaseYear: firstRelease.releaseYear,
      abv: firstRelease.abv,
      singleCask: firstRelease.singleCask,
      caskStrength: firstRelease.caskStrength,
      caskSize: firstRelease.caskSize,
      caskType: firstRelease.caskType,
      caskFill: firstRelease.caskFill,
      description: parent.description,
      descriptionSrc: parent.descriptionSrc,
      imageUrl: parent.imageUrl,
      tastingNotes: parent.tastingNotes,
      suggestedTags: parent.suggestedTags,
      createdByActorId: firstCreator.id,
      createdAt: firstCreatedAt,
      updatedAt: firstUpdatedAt,
    });
    expect(promotedByReleaseId.get(secondRelease.id)).toMatchObject({
      groupId: result.groupId,
      name: secondRelease.name,
      fullName: secondRelease.fullName,
      statedAge: secondRelease.statedAge,
      description: secondRelease.description,
      descriptionSrc: secondRelease.descriptionSrc,
      imageUrl: secondRelease.imageUrl,
      tastingNotes: secondRelease.tastingNotes,
      suggestedTags: secondRelease.suggestedTags,
      createdByActorId: secondCreator.id,
      createdAt: secondCreatedAt,
      updatedAt: secondUpdatedAt,
    });

    const expectedDistillers = [firstDistiller.id, secondDistiller.id].sort(
      (left, right) => left - right,
    );
    for (const { bottleId } of result.promoted) {
      expect(
        await db
          .select({ distillerId: bottlesToDistillers.distillerId })
          .from(bottlesToDistillers)
          .where(eq(bottlesToDistillers.bottleId, bottleId))
          .orderBy(asc(bottlesToDistillers.distillerId)),
      ).toEqual(expectedDistillers.map((distillerId) => ({ distillerId })));
      expect(
        await db
          .select({ tag: bottleTags.tag, count: bottleTags.count })
          .from(bottleTags)
          .where(eq(bottleTags.bottleId, bottleId))
          .orderBy(asc(bottleTags.tag)),
      ).toEqual([
        { tag: "fruit", count: 3 },
        { tag: "smoke", count: 7 },
      ]);
      expect(
        await db
          .select({
            flavorProfile: bottleFlavorProfiles.flavorProfile,
            count: bottleFlavorProfiles.count,
          })
          .from(bottleFlavorProfiles)
          .where(eq(bottleFlavorProfiles.bottleId, bottleId))
          .orderBy(asc(bottleFlavorProfiles.flavorProfile)),
      ).toEqual([
        { flavorProfile: "sweet_fruit_mellow", count: 4 },
        { flavorProfile: "peated", count: 9 },
      ]);
    }
    expect(
      await db
        .select({
          releaseId: bottleReleasePromotions.releaseId,
          bottleId: bottleReleasePromotions.promotedBottleId,
          status: bottleReleasePromotions.status,
          completedAt: bottleReleasePromotions.completedAt,
        })
        .from(bottleReleasePromotions)
        .orderBy(asc(bottleReleasePromotions.releaseId)),
    ).toEqual(
      result.promoted.map(({ releaseId, bottleId }) => ({
        releaseId,
        bottleId,
        status: "promoted",
        completedAt: expect.any(Date),
      })),
    );

    const countsBeforeRerun = {
      bottles: await tableCount(bottles),
      groups: await tableCount(bottleGroups),
      targets: await tableCount(catalogTargets),
      promotions: await tableCount(bottleReleasePromotions),
      distillers: await tableCount(bottlesToDistillers),
      tags: await tableCount(bottleTags),
      flavorProfiles: await tableCount(bottleFlavorProfiles),
    };
    const rerun = await backfillLegacyCatalogParent(parent.id);
    expect(rerun).toEqual({
      ...result,
      outcome: "reused",
      promoted: result.promoted.map((promotion) => ({
        ...promotion,
        outcome: "reused",
      })),
    });
    expect({
      bottles: await tableCount(bottles),
      groups: await tableCount(bottleGroups),
      targets: await tableCount(catalogTargets),
      promotions: await tableCount(bottleReleasePromotions),
      distillers: await tableCount(bottlesToDistillers),
      tags: await tableCount(bottleTags),
      flavorProfiles: await tableCount(bottleFlavorProfiles),
    }).toEqual(countsBeforeRerun);
  });

  test("processes legacy parents in resumable keyset pages", async ({
    fixtures,
  }) => {
    const parents = [
      await fixtures.LegacyBottle(),
      await fixtures.LegacyBottle(),
      await fixtures.LegacyBottle(),
    ].sort((left, right) => left.id - right.id);
    await fixtures.Bottle();

    const firstPage = await backfillLegacyCatalogBatch({ limit: 2 });
    expect(firstPage).toMatchObject({
      afterParentId: 0,
      nextParentId: parents[1]?.id,
      processed: 2,
      created: 2,
      reused: 0,
    });
    expect(firstPage.parents.map(({ parentId }) => parentId)).toEqual(
      parents.slice(0, 2).map(({ id }) => id),
    );

    const secondPage = await backfillLegacyCatalogBatch({
      afterParentId: firstPage.nextParentId!,
      limit: 2,
    });
    expect(secondPage).toMatchObject({
      afterParentId: parents[1]?.id,
      nextParentId: null,
      processed: 1,
      created: 1,
      reused: 0,
    });
    expect(secondPage.parents.map(({ parentId }) => parentId)).toEqual([
      parents[2]?.id,
    ]);
  });

  test("claims and preserves a release canonical alias for its promoted Bottle", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      name: "Canonical alias family",
      fullName: "Canonical Brand Canonical alias family",
    });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Canonical alias release",
      fullName: "Canonical Brand Canonical alias release",
    });
    const legacyAlias = await fixtures.BottleAlias({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
      name: release.fullName,
      assignmentSource: "legacy",
    });

    const created = await backfillLegacyCatalogParent(parent.id);
    expect(created.promoted).toHaveLength(1);
    const promotion = created.promoted[0]!;
    const aliasesAfterCreate = await db
      .select()
      .from(bottleAliases)
      .where(
        eq(
          sql<string>`LOWER(${bottleAliases.name})`,
          release.fullName.toLowerCase(),
        ),
      );
    expect(aliasesAfterCreate).toHaveLength(1);
    expect(aliasesAfterCreate[0]).toMatchObject({
      name: legacyAlias.name,
      bottleId: promotion.bottleId,
      releaseId: null,
      targetId: promotion.targetId,
      ignored: false,
      assignmentSource: "canonical",
      assignedByActorId: release.createdByActorId,
    });

    const rerun = await backfillLegacyCatalogParent(parent.id);
    expect(rerun).toMatchObject({ outcome: "reused" });
    expect(
      await db
        .select()
        .from(bottleAliases)
        .where(
          eq(
            sql<string>`LOWER(${bottleAliases.name})`,
            release.fullName.toLowerCase(),
          ),
        ),
    ).toEqual(aliasesAfterCreate);
  });

  test("atomically reserves a canonical alias across concurrent parent families", async ({
    fixtures,
  }) => {
    const firstParent = await fixtures.LegacyBottle({
      name: "First concurrent family",
      fullName: "Concurrent Brand First concurrent family",
    });
    const secondParent = await fixtures.LegacyBottle({
      name: "Second concurrent family",
      fullName: "Concurrent Brand Second concurrent family",
    });
    const firstRelease = await fixtures.BottleRelease({
      bottleId: firstParent.id,
      name: "Shared concurrent release",
      fullName: "Concurrent Brand Shared Release",
    });
    const secondRelease = await fixtures.BottleRelease({
      bottleId: secondParent.id,
      name: "Shared concurrent release",
      fullName: "CONCURRENT BRAND SHARED RELEASE",
    });

    const outcomes = await Promise.allSettled([
      backfillLegacyCatalogParent(firstParent.id),
      backfillLegacyCatalogParent(secondParent.id),
    ]);
    const fulfilled = outcomes.filter(
      (outcome) => outcome.status === "fulfilled",
    );
    const rejected = outcomes.filter(
      (outcome) => outcome.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(CatalogMigrationBackfillError);
    expect(["name_collision", "alias_collision"]).toContain(
      rejected[0]!.reason.code,
    );

    const winner = fulfilled[0]!.value;
    const loser =
      winner.parentId === firstParent.id
        ? { parent: secondParent, release: secondRelease }
        : { parent: firstParent, release: firstRelease };
    await expectParentUnchanged(loser.parent.id);
    expect(
      await db
        .select()
        .from(bottleGroups)
        .where(eq(bottleGroups.fullName, loser.parent.fullName)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(bottleReleasePromotions)
        .where(eq(bottleReleasePromotions.releaseId, loser.release.id)),
    ).toEqual([]);

    const matchingBottles = await db
      .select({ id: bottles.id })
      .from(bottles)
      .where(
        eq(
          sql<string>`LOWER(${bottles.fullName})`,
          firstRelease.fullName.toLowerCase(),
        ),
      );
    expect(matchingBottles).toEqual([{ id: winner.promoted[0]!.bottleId }]);
    expect(
      await db
        .select({
          bottleId: bottleAliases.bottleId,
          targetId: bottleAliases.targetId,
          assignmentSource: bottleAliases.assignmentSource,
          ignored: bottleAliases.ignored,
        })
        .from(bottleAliases)
        .where(
          eq(
            sql<string>`LOWER(${bottleAliases.name})`,
            firstRelease.fullName.toLowerCase(),
          ),
        ),
    ).toEqual([
      {
        bottleId: winner.promoted[0]!.bottleId,
        targetId: winner.promoted[0]!.targetId,
        assignmentSource: "canonical",
        ignored: false,
      },
    ]);
  });

  test("rejects pending and failed mappings without writing graphs", async ({
    fixtures,
  }) => {
    for (const status of ["pending", "failed"] as const) {
      const parent = await fixtures.LegacyBottle();
      const release = await fixtures.BottleRelease({
        bottleId: parent.id,
        name: `Blocked ${status} release`,
        fullName: `Blocked ${status} release full name`,
      });
      await db.insert(bottleReleasePromotions).values({
        releaseId: release.id,
        status,
        error: status === "failed" ? "fixture failure" : null,
        startedAt: new Date(),
        createdByActorId: release.createdByActorId,
      });

      await expectBackfillError(
        backfillLegacyCatalogParent(parent.id),
        "partial_promotion",
      );
      await expectParentUnchanged(parent.id);
      expect(
        await db
          .select()
          .from(bottles)
          .where(eq(bottles.fullName, release.fullName)),
      ).toEqual([]);
    }
  });

  test("rejects and preserves a corrupt completed promotion", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Corrupt mapped release",
      fullName: "Corrupt mapped release full name",
    });
    const created = await backfillLegacyCatalogParent(parent.id);
    const [mapping] = await db
      .select()
      .from(bottleReleasePromotions)
      .where(eq(bottleReleasePromotions.releaseId, release.id));
    expect(mapping).toMatchObject({
      status: "promoted",
      promotedBottleId: created.promoted[0]?.bottleId,
      completedAt: expect.any(Date),
      error: null,
    });
    const corruptedName = "Corrupted after completed promotion";
    await db
      .update(bottles)
      .set({ name: corruptedName })
      .where(eq(bottles.id, mapping!.promotedBottleId!));

    await expectBackfillError(
      backfillLegacyCatalogParent(parent.id),
      "promotion_mismatch",
    );
    const [stillCorrupt] = await db
      .select({ name: bottles.name })
      .from(bottles)
      .where(eq(bottles.id, mapping!.promotedBottleId!));
    expect(stillCorrupt?.name).toBe(corruptedName);
    expect(
      await db
        .select()
        .from(bottleReleasePromotions)
        .where(eq(bottleReleasePromotions.releaseId, release.id)),
    ).toEqual([mapping]);
  });

  test("rejects an additional canonical Bottle collision on promotion rerun", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Completed promotion canonical name",
      fullName: "Completed promotion canonical full name",
    });
    const created = await backfillLegacyCatalogParent(parent.id);
    const promotion = created.promoted[0]!;
    const duplicate = await fixtures.LegacyBottle({
      name: "Unrelated duplicate before drift",
      fullName: "Unrelated duplicate before drift full name",
    });
    await db
      .update(bottles)
      .set({ fullName: release.fullName.toUpperCase() })
      .where(eq(bottles.id, duplicate.id));

    const error = await expectBackfillError(
      backfillLegacyCatalogParent(parent.id),
      "name_collision",
    );
    expect(error).toMatchObject({ parentId: parent.id, releaseId: release.id });
    expect(
      await db
        .select({ id: bottles.id, fullName: bottles.fullName })
        .from(bottles)
        .where(inArray(bottles.id, [promotion.bottleId, duplicate.id]))
        .orderBy(asc(bottles.id)),
    ).toEqual(
      [
        { id: promotion.bottleId, fullName: release.fullName },
        { id: duplicate.id, fullName: release.fullName.toUpperCase() },
      ].sort((left, right) => left.id - right.id),
    );
    expect(
      await db
        .select()
        .from(bottleReleasePromotions)
        .where(eq(bottleReleasePromotions.releaseId, release.id)),
    ).toMatchObject([
      { status: "promoted", promotedBottleId: promotion.bottleId },
    ]);
  });

  test("rejects release-like fields on a parent before migration writes", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({ edition: "Parent batch" });
    await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Child release",
      fullName: "Child release full name",
    });

    const error = await expectBackfillError(
      backfillLegacyCatalogParent(parent.id),
      "ambiguous_parent_identity",
    );
    expect(error.details).toEqual({ fields: ["edition"] });
    await expectParentUnchanged(parent.id);
  });

  test("rejects a release colliding with its parent canonical name", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: parent.name,
      fullName: parent.fullName,
    });

    const error = await expectBackfillError(
      backfillLegacyCatalogParent(parent.id),
      "name_collision",
    );
    expect(error).toMatchObject({ parentId: parent.id, releaseId: release.id });
    await expectParentUnchanged(parent.id);
  });

  test("reports an existing partial group without healing it", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const [group] = await db
      .insert(bottleGroups)
      .values({
        name: parent.name,
        fullName: parent.fullName,
        statedAge: parent.statedAge,
        seriesId: parent.seriesId,
        category: parent.category,
        brandId: parent.brandId,
        bottlerId: parent.bottlerId,
        flavorProfile: parent.flavorProfile,
        description: parent.description,
        descriptionSrc: parent.descriptionSrc,
        imageUrl: parent.imageUrl,
        tastingNotes: parent.tastingNotes,
        suggestedTags: parent.suggestedTags,
        createdAt: parent.createdAt,
        updatedAt: parent.updatedAt,
        createdByActorId: parent.createdByActorId,
      })
      .returning();
    await db
      .update(bottles)
      .set({ groupId: group!.id })
      .where(eq(bottles.id, parent.id));

    await expectBackfillError(
      backfillLegacyCatalogParent(parent.id),
      "partial_group_graph",
    );
    expect(
      await db
        .select()
        .from(catalogTargets)
        .where(eq(catalogTargets.groupId, group!.id)),
    ).toEqual([]);
    const [unchangedGroup] = await db
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, group!.id));
    expect(unchangedGroup).toMatchObject({
      representativeBottleId: null,
      totalBottles: 0,
    });
  });

  test("rejects a promoted full-name collision before migration writes", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const existing = await fixtures.Bottle({
      name: "Existing exact Bottle",
      fullName: "Existing exact Bottle full name",
    });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Colliding release",
      fullName: existing.fullName,
    });

    const error = await expectBackfillError(
      backfillLegacyCatalogParent(parent.id),
      "name_collision",
    );
    expect(error).toMatchObject({ parentId: parent.id, releaseId: release.id });
    await expectParentUnchanged(parent.id);
  });

  test("rejects a promoted alias collision before migration writes", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Alias collision release",
      fullName: "Alias collision release full name",
    });
    await fixtures.BottleAlias({ name: release.fullName });

    const error = await expectBackfillError(
      backfillLegacyCatalogParent(parent.id),
      "alias_collision",
    );
    expect(error).toMatchObject({ parentId: parent.id, releaseId: release.id });
    await expectParentUnchanged(parent.id);
  });

  test("rejects a family-owned alias colliding with a Bottle name before writes", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle();
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Release with alternate alias",
      fullName: "Release with alternate alias full name",
    });
    const existing = await fixtures.Bottle({
      name: "Existing canonical destination",
      fullName: "Existing canonical destination full name",
    });
    await db
      .update(bottleAliases)
      .set({ name: "Existing destination historical alias" })
      .where(eq(bottleAliases.bottleId, existing.id));
    await fixtures.BottleAlias({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: null,
      name: existing.fullName,
    });

    const error = await expectBackfillError(
      backfillLegacyCatalogParent(parent.id),
      "alias_collision",
    );
    expect(error).toMatchObject({ parentId: parent.id, releaseId: release.id });
    await expectParentUnchanged(parent.id);
    expect(
      await db
        .select()
        .from(bottleReleasePromotions)
        .where(eq(bottleReleasePromotions.releaseId, release.id)),
    ).toEqual([]);
  });
});
