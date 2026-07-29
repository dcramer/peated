import { asc, eq, inArray } from "drizzle-orm";
import { SIMPLE_RATING_VALUES } from "../constants";
import { db, type AnyConnection, type AnyTransaction } from "../db";
import {
  bottleAliases,
  bottleFlavorProfiles,
  bottleGroupDistillers,
  bottleGroups,
  bottleReleasePromotions,
  bottles,
  bottlesToDistillers,
  bottleTags,
  bottleTombstones,
  tastings,
} from "../db/schema";
import type { CatalogMigrationApplyInput } from "../schemas/catalogMigrationApply";
import {
  applyCatalogMigration,
  CatalogMigrationApplyError,
} from "./catalogMigrationApply";
import { loadCatalogMigrationApprovalCandidate } from "./catalogMigrationApprovalCandidate";
import { CatalogMigrationDatabaseEvidenceError } from "./catalogMigrationDatabaseEvidence";
import waitError from "./test/waitError";

const TEST_GIT_REVISION = "a".repeat(40);

async function approvedInput(): Promise<CatalogMigrationApplyInput> {
  const candidate =
    await loadCatalogMigrationApprovalCandidate(TEST_GIT_REVISION);
  return {
    candidate,
    approval: {
      approvedBy: "catalog-migration-test",
      approvedAt: new Date(
        Date.parse(candidate.audit.generatedAt) + 1_000,
      ).toISOString(),
    },
  };
}

describe("applyCatalogMigration", () => {
  test("claims unresolved canonical aliases for retained and promoted Bottles", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      name: "Unresolved Alias Family",
    });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      fullName: `${parent.fullName} 2026`,
      name: `${parent.name} 2026`,
    });
    await db.delete(bottleAliases).where(eq(bottleAliases.bottleId, parent.id));
    await Promise.all([
      fixtures.BottleAlias({
        bottleId: null,
        releaseId: null,
        name: parent.fullName,
        assignedByActorId: parent.createdByActorId,
      }),
      fixtures.BottleAlias({
        bottleId: null,
        releaseId: null,
        name: release.fullName,
        assignedByActorId: release.createdByActorId,
      }),
    ]);
    const input = await approvedInput();

    expect(input.candidate.audit.blockingIssueCount).toBe(0);

    const result = await applyCatalogMigration(input);
    const mapping = await db.query.bottleReleasePromotions.findFirst({
      where: eq(bottleReleasePromotions.releaseId, release.id),
    });
    const aliases = await db
      .select({
        name: bottleAliases.name,
        bottleId: bottleAliases.bottleId,
        releaseId: bottleAliases.releaseId,
        assignmentSource: bottleAliases.assignmentSource,
      })
      .from(bottleAliases)
      .where(inArray(bottleAliases.name, [parent.fullName, release.fullName]))
      .orderBy(asc(bottleAliases.name));

    expect(result.status).toBe("applied");
    expect(mapping?.promotedBottleId).not.toBeNull();
    expect(aliases).toEqual(
      [
        { name: parent.fullName, bottleId: parent.id },
        { name: release.fullName, bottleId: mapping?.promotedBottleId },
      ]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((alias) => ({
          ...alias,
          releaseId: null,
          assignmentSource: "canonical",
        })),
    );
  });

  test("groups literal duplicate legacy parents without merging their Bottle identities", async ({
    fixtures,
  }) => {
    const firstParent = await fixtures.LegacyBottle({
      fullName: "Migration Duplicate Family",
      name: "Duplicate Family",
    });
    const secondParent = await fixtures.LegacyBottle({
      name: "Temporary Duplicate Family",
    });
    await db
      .delete(bottleAliases)
      .where(eq(bottleAliases.bottleId, secondParent.id));
    await db
      .update(bottles)
      .set({ fullName: firstParent.fullName, name: firstParent.name })
      .where(eq(bottles.id, secondParent.id));
    const firstRelease = await fixtures.BottleRelease({
      bottleId: firstParent.id,
      fullName: "Migration Duplicate Family 2024",
      name: "Duplicate Family 2024",
    });
    const secondRelease = await fixtures.BottleRelease({
      bottleId: secondParent.id,
      fullName: "Migration Duplicate Family 2025",
      name: "Duplicate Family 2025",
    });
    const input = await approvedInput();

    expect(input.candidate.audit.blockingIssueCount).toBe(0);

    const result = await applyCatalogMigration(input);
    const parentRows = await db
      .select({ id: bottles.id, groupId: bottles.groupId })
      .from(bottles)
      .where(inArray(bottles.id, [firstParent.id, secondParent.id]))
      .orderBy(asc(bottles.id));
    const groups = await db.select().from(bottleGroups);
    const mappings = await db
      .select()
      .from(bottleReleasePromotions)
      .orderBy(asc(bottleReleasePromotions.releaseId));

    expect(result.status).toBe("applied");
    expect(result.counts).toMatchObject({
      parents: 2,
      groups: 1,
      parentBottlesAssigned: 2,
      releases: 2,
      promotedBottles: 2,
      groupStatsRecomputed: 1,
    });
    expect(parentRows[0]?.groupId).not.toBeNull();
    expect(parentRows[1]?.groupId).toBe(parentRows[0]?.groupId);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      representativeBottleId: firstParent.id,
      totalBottles: 4,
    });
    expect(mappings.map(({ releaseId }) => releaseId)).toEqual([
      firstRelease.id,
      secondRelease.id,
    ]);
    expect(await db.select().from(bottleTombstones)).toEqual([]);

    const repeated = await applyCatalogMigration(input);
    expect(repeated.status).toBe("already_complete");
    expect(await db.select().from(bottleGroups)).toHaveLength(1);
  });

  test("reassigns a same-family canonical alias to its promoted Bottle", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      edition: "Legacy Edition",
      statedAge: 10,
    });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      fullName: `${parent.fullName} 12 Year`,
      name: `${parent.name} 12 Year`,
      statedAge: 12,
    });
    await db.insert(bottleAliases).values({
      bottleId: parent.id,
      name: release.fullName,
      assignedByActorId: parent.createdByActorId,
    });
    const input = await approvedInput();

    expect(input.candidate.audit.blockingIssueCount).toBe(0);

    const result = await applyCatalogMigration(input);
    const mapping = await db.query.bottleReleasePromotions.findFirst({
      where: eq(bottleReleasePromotions.releaseId, release.id),
    });
    const alias = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, release.fullName),
    });

    expect(result.status).toBe("applied");
    expect(mapping).toBeDefined();
    expect(alias).toMatchObject({
      bottleId: mapping?.promotedBottleId,
      releaseId: null,
      assignmentSource: "canonical",
    });
  });

  test("promotes zero, one, and multi-release families atomically and is idempotent", async ({
    fixtures,
  }) => {
    const parentCreatedAt = new Date("2020-01-02T03:04:05.000Z");
    const parentUpdatedAt = new Date("2021-02-03T04:05:06.000Z");
    const releaseCreatedAt = new Date("2022-03-04T05:06:07.000Z");
    const releaseUpdatedAt = new Date("2023-04-05T06:07:08.000Z");
    const brand = await fixtures.Entity({ name: "Migration Brand" });
    const bottler = await fixtures.Entity({ name: "Migration Bottler" });
    const distiller = await fixtures.Entity({ name: "Migration Distiller" });
    const series = await fixtures.BottleSeries({
      name: "Migration Series",
      brandId: brand.id,
    });
    const zeroReleaseParent = await fixtures.LegacyBottle({
      name: "Migration Zero",
      fullName: "Migration Brand Zero",
      imageUrl: "https://peated.test/zero.jpg",
    });
    const oneReleaseParent = await fixtures.LegacyBottle({
      name: "Migration One",
      fullName: "Migration Brand One",
      imageUrl: "https://peated.test/one.jpg",
      brandId: brand.id,
      bottlerId: bottler.id,
      distillerIds: [distiller.id],
      seriesId: series.id,
      category: "single_malt",
      flavorProfile: "spicy_sweet",
      statedAge: null,
      description: "Parent content must be overridden.",
      descriptionSrc: "generated",
      tastingNotes: {
        nose: "Parent override nose",
        palate: "Parent override palate",
        finish: "Parent override finish",
      },
      suggestedTags: ["parent-override-tag"],
      createdAt: parentCreatedAt,
      updatedAt: parentUpdatedAt,
    });
    const multiReleaseParent = await fixtures.LegacyBottle({
      name: "Migration Multi",
      fullName: "Migration Brand Multi",
      imageUrl: "https://peated.test/multi.jpg",
      brandId: brand.id,
      bottlerId: bottler.id,
      seriesId: series.id,
      category: "rye",
      flavorProfile: "oily_coastal",
      statedAge: 10,
      description: "Parent fallback description.",
      descriptionSrc: "generated",
      tastingNotes: {
        nose: "Parent fallback nose",
        palate: "Parent fallback palate",
        finish: "Parent fallback finish",
      },
      suggestedTags: ["parent-fallback-tag"],
    });
    const oneRelease = await fixtures.BottleRelease({
      bottleId: oneReleaseParent.id,
      name: "Migration One 2025",
      fullName: "Migration Brand One 2025",
      edition: "2025",
      statedAge: 18,
      abv: 46,
      singleCask: true,
      caskStrength: true,
      vintageYear: 2007,
      releaseYear: 2025,
      caskSize: "hogshead",
      caskType: "bourbon",
      caskFill: "1st_fill",
      description: "Release-owned exact content.",
      descriptionSrc: "user",
      imageUrl: "https://peated.test/one-2025.jpg",
      tastingNotes: {
        nose: "Release nose",
        palate: "Release palate",
        finish: "Release finish",
      },
      suggestedTags: ["release-tag"],
      createdAt: releaseCreatedAt,
      updatedAt: releaseUpdatedAt,
    });
    const multiReleases = await Promise.all([
      fixtures.BottleRelease({
        bottleId: multiReleaseParent.id,
        name: "Migration Multi Batch 1",
        fullName: "Migration Brand Multi Batch 1",
        edition: "Batch 1",
        statedAge: null,
        description: null,
        descriptionSrc: null,
        imageUrl: null,
        tastingNotes: null,
        suggestedTags: [],
        singleCask: null,
        caskStrength: null,
        caskSize: null,
        caskType: null,
        caskFill: null,
      }),
      fixtures.BottleRelease({
        bottleId: multiReleaseParent.id,
        name: "Migration Multi Batch 2",
        fullName: "Migration Brand Multi Batch 2",
        edition: "Batch 2",
        imageUrl: "https://peated.test/multi-2.jpg",
      }),
    ]);
    await db.insert(bottleAliases).values(
      [oneRelease, ...multiReleases].map((release) => ({
        bottleId: release.bottleId,
        releaseId: release.id,
        name: release.fullName,
        assignedByActorId: release.createdByActorId,
      })),
    );
    await db.insert(bottleTags).values({
      bottleId: oneReleaseParent.id,
      tag: "migration-tag",
      count: 3,
    });
    await db.insert(bottleFlavorProfiles).values({
      bottleId: oneReleaseParent.id,
      flavorProfile: "spicy_dry",
      count: 2,
    });
    const parentTasting = await fixtures.Tasting({
      bottleId: oneReleaseParent.id,
      releaseId: null,
      rating: SIMPLE_RATING_VALUES.PASS,
      notes: "parent-only evidence",
      tags: [],
      createdAt: new Date("2024-05-06T07:08:09.000Z"),
    });
    const releaseTasting = await fixtures.Tasting({
      bottleId: oneReleaseParent.id,
      releaseId: oneRelease.id,
      rating: SIMPLE_RATING_VALUES.SAVOR,
      notes: "release-specific evidence",
      tags: [],
      createdAt: new Date("2024-05-06T07:08:10.000Z"),
    });

    const input = await approvedInput();
    const auditConnection = {
      serverAddress: "192.0.2.10",
      serverPort: 6432,
      currentUser: "retained_catalog_auditor",
    };
    input.candidate.audit.databaseEvidence.connection = auditConnection;
    input.candidate.revision.databaseEvidence.connection = auditConnection;
    const result = await applyCatalogMigration(input);

    expect(result.status).toBe("applied");
    expect(result.revision.databaseEvidence.connection).not.toEqual(
      auditConnection,
    );
    expect(result.revision.databaseEvidence.identity).toEqual(
      input.candidate.revision.databaseEvidence.identity,
    );
    expect(result.counts).toEqual({
      parents: 3,
      groups: 3,
      parentBottlesAssigned: 3,
      releases: 3,
      promotedBottles: 3,
      promotionMappings: 3,
      canonicalAliasesChanged: 6,
      canonicalAliasesReused: 6,
      groupDistillers: 1,
      bottleDistillers: 1,
      bottleTags: 1,
      bottleFlavorProfiles: 1,
      bottleStatsRecomputed: 6,
      groupStatsRecomputed: 3,
      consumers: {
        bySlot: {
          bottle_alias: 3,
          bottle_observation: 0,
          tasting: 1,
          review: 0,
          collection_bottle: 0,
          flight_bottle: 0,
          store_price: 0,
          incoming_bottle_decision_log: 0,
          "store_price_match_proposal.current": 0,
          "store_price_match_proposal.suggested": 0,
          "store_price_match_attempt.current": 0,
          "store_price_match_attempt.suggested": 0,
        },
        total: 4,
      },
    });
    expect(result.postflightAudit).toMatchObject({
      blockingIssueCount: 0,
      collisions: { count: 0 },
      promotionMappings: {
        totalLegacyReleases: 3,
        totalMappings: 3,
        validMappings: 3,
        unmappedReleases: 0,
      },
    });

    const parentRows = await db
      .select()
      .from(bottles)
      .where(
        inArray(bottles.id, [
          zeroReleaseParent.id,
          oneReleaseParent.id,
          multiReleaseParent.id,
        ]),
      )
      .orderBy(asc(bottles.id));
    expect(parentRows.every(({ groupId }) => groupId !== null)).toBe(true);
    for (const parent of parentRows) {
      const group = await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, parent.groupId as number),
      });
      expect(group?.representativeBottleId).toBe(parent.id);
    }

    const mappings = await db
      .select()
      .from(bottleReleasePromotions)
      .orderBy(asc(bottleReleasePromotions.releaseId));
    expect(mappings).toHaveLength(3);
    expect(
      mappings.every(({ promotedBottleId }) => promotedBottleId !== null),
    ).toBe(true);
    const oneMapping = mappings.find(
      ({ releaseId }) => releaseId === oneRelease.id,
    );
    expect(oneMapping?.promotedBottleId).not.toBeNull();
    const promotedOne = await db.query.bottles.findFirst({
      where: eq(bottles.id, oneMapping?.promotedBottleId as number),
    });
    expect(oneReleaseParent.statedAge).toBeNull();
    expect(promotedOne).toMatchObject({
      groupId: parentRows.find(({ id }) => id === oneReleaseParent.id)?.groupId,
      name: oneRelease.name,
      fullName: oneRelease.fullName,
      statedAge: oneRelease.statedAge,
      seriesId: oneReleaseParent.seriesId,
      category: oneReleaseParent.category,
      brandId: oneReleaseParent.brandId,
      bottlerId: oneReleaseParent.bottlerId,
      flavorProfile: oneReleaseParent.flavorProfile,
      edition: oneRelease.edition,
      abv: oneRelease.abv,
      singleCask: oneRelease.singleCask,
      caskStrength: oneRelease.caskStrength,
      vintageYear: oneRelease.vintageYear,
      releaseYear: oneRelease.releaseYear,
      caskSize: oneRelease.caskSize,
      caskType: oneRelease.caskType,
      caskFill: oneRelease.caskFill,
      description: oneRelease.description,
      descriptionSrc: oneRelease.descriptionSrc,
      imageUrl: oneRelease.imageUrl,
      tastingNotes: oneRelease.tastingNotes,
      suggestedTags: oneRelease.suggestedTags,
      createdByActorId: oneRelease.createdByActorId,
      totalTastings: 1,
      avgRating: SIMPLE_RATING_VALUES.SAVOR,
      ratingStats: {
        pass: 0,
        sip: 0,
        savor: 1,
        total: 1,
        avg: SIMPLE_RATING_VALUES.SAVOR,
        percentage: { pass: 0, sip: 0, savor: 100 },
      },
    });
    expect(promotedOne?.createdAt).toEqual(releaseCreatedAt);
    expect(promotedOne?.updatedAt).toEqual(releaseUpdatedAt);
    const fallbackMapping = mappings.find(
      ({ releaseId }) => releaseId === multiReleases[0]?.id,
    );
    expect(fallbackMapping?.promotedBottleId).not.toBeNull();
    const promotedFallback = await db.query.bottles.findFirst({
      where: eq(bottles.id, fallbackMapping?.promotedBottleId as number),
    });
    expect(multiReleases[0]?.statedAge).toBeNull();
    expect(promotedFallback).toMatchObject({
      groupId: parentRows.find(({ id }) => id === multiReleaseParent.id)
        ?.groupId,
      name: multiReleases[0]?.name,
      fullName: multiReleases[0]?.fullName,
      statedAge: multiReleaseParent.statedAge,
      seriesId: multiReleaseParent.seriesId,
      category: multiReleaseParent.category,
      brandId: multiReleaseParent.brandId,
      bottlerId: multiReleaseParent.bottlerId,
      flavorProfile: multiReleaseParent.flavorProfile,
      edition: multiReleases[0]?.edition,
      description: multiReleaseParent.description,
      descriptionSrc: multiReleaseParent.descriptionSrc,
      imageUrl: multiReleaseParent.imageUrl,
      tastingNotes: multiReleaseParent.tastingNotes,
      suggestedTags: multiReleaseParent.suggestedTags,
      singleCask: null,
      caskStrength: null,
      caskSize: null,
      caskType: null,
      caskFill: null,
    });
    expect(
      await db
        .select()
        .from(bottlesToDistillers)
        .where(eq(bottlesToDistillers.bottleId, promotedOne?.id as number)),
    ).toEqual([
      expect.objectContaining({
        bottleId: promotedOne?.id,
        distillerId: distiller.id,
      }),
    ]);
    expect(
      await db
        .select()
        .from(bottleGroupDistillers)
        .where(
          eq(bottleGroupDistillers.groupId, promotedOne?.groupId as number),
        ),
    ).toEqual([
      expect.objectContaining({
        groupId: promotedOne?.groupId,
        distillerId: distiller.id,
      }),
    ]);
    expect(
      await db
        .select()
        .from(bottleTags)
        .where(eq(bottleTags.bottleId, promotedOne?.id as number)),
    ).toEqual([expect.objectContaining({ tag: "migration-tag", count: 3 })]);
    expect(
      await db
        .select()
        .from(bottleFlavorProfiles)
        .where(eq(bottleFlavorProfiles.bottleId, promotedOne?.id as number)),
    ).toEqual([
      expect.objectContaining({ flavorProfile: "spicy_dry", count: 2 }),
    ]);
    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, parentTasting.id),
      }),
    ).toMatchObject({
      bottleId: oneReleaseParent.id,
      releaseId: null,
      notes: "parent-only evidence",
    });
    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, releaseTasting.id),
      }),
    ).toMatchObject({
      bottleId: promotedOne?.id,
      releaseId: oneRelease.id,
      notes: "release-specific evidence",
    });
    const migratedParent = parentRows.find(
      ({ id }) => id === oneReleaseParent.id,
    );
    expect(migratedParent).toMatchObject({
      totalTastings: 1,
      avgRating: SIMPLE_RATING_VALUES.PASS,
      ratingStats: {
        pass: 1,
        sip: 0,
        savor: 0,
        total: 1,
        avg: SIMPLE_RATING_VALUES.PASS,
        percentage: { pass: 100, sip: 0, savor: 0 },
      },
    });
    expect(migratedParent?.createdAt).toEqual(parentCreatedAt);
    expect(migratedParent?.updatedAt).toEqual(parentUpdatedAt);
    const oneGroup = await db.query.bottleGroups.findFirst({
      where: eq(bottleGroups.id, migratedParent?.groupId as number),
    });
    expect(oneGroup).toMatchObject({
      representativeBottleId: oneReleaseParent.id,
      totalBottles: 2,
      totalTastings: 2,
      avgRating: (SIMPLE_RATING_VALUES.PASS + SIMPLE_RATING_VALUES.SAVOR) / 2,
      ratingStats: {
        pass: 1,
        sip: 0,
        savor: 1,
        total: 2,
        avg: (SIMPLE_RATING_VALUES.PASS + SIMPLE_RATING_VALUES.SAVOR) / 2,
        percentage: { pass: 50, sip: 0, savor: 50 },
      },
    });
    expect(oneGroup?.createdAt).toEqual(parentCreatedAt);
    expect(oneGroup?.updatedAt).toEqual(parentUpdatedAt);

    const secondResult = await applyCatalogMigration(input);
    expect(secondResult.status).toBe("already_complete");
    expect(secondResult.counts).toEqual({
      parents: 0,
      groups: 0,
      parentBottlesAssigned: 0,
      releases: 0,
      promotedBottles: 0,
      promotionMappings: 0,
      canonicalAliasesChanged: 0,
      canonicalAliasesReused: 0,
      groupDistillers: 0,
      bottleDistillers: 0,
      bottleTags: 0,
      bottleFlavorProfiles: 0,
      bottleStatsRecomputed: 0,
      groupStatsRecomputed: 0,
      consumers: {
        bySlot: {
          bottle_alias: 0,
          bottle_observation: 0,
          tasting: 0,
          review: 0,
          collection_bottle: 0,
          flight_bottle: 0,
          store_price: 0,
          incoming_bottle_decision_log: 0,
          "store_price_match_proposal.current": 0,
          "store_price_match_proposal.suggested": 0,
          "store_price_match_attempt.current": 0,
          "store_price_match_attempt.suggested": 0,
        },
        total: 0,
      },
    });
    expect(await db.select().from(bottles)).toHaveLength(6);
    expect(await db.select().from(bottleGroups)).toHaveLength(3);
  });

  test("leaves a retired zero-release Bottle untouched", async ({
    fixtures,
  }) => {
    const retired = await fixtures.LegacyBottle({
      fullName: "Migration Retired General Bottle",
      createdAt: new Date("2019-01-02T03:04:05.000Z"),
      updatedAt: new Date("2020-02-03T04:05:06.000Z"),
    });
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: null,
    });
    const bottleBefore = await db.query.bottles.findFirst({
      where: eq(bottles.id, retired.id),
    });
    const aliasesBefore = await db
      .select()
      .from(bottleAliases)
      .where(eq(bottleAliases.bottleId, retired.id));

    const result = await applyCatalogMigration(await approvedInput());

    expect(result.status).toBe("already_complete");
    expect(result.counts).toEqual({
      parents: 0,
      groups: 0,
      parentBottlesAssigned: 0,
      releases: 0,
      promotedBottles: 0,
      promotionMappings: 0,
      canonicalAliasesChanged: 0,
      canonicalAliasesReused: 0,
      groupDistillers: 0,
      bottleDistillers: 0,
      bottleTags: 0,
      bottleFlavorProfiles: 0,
      bottleStatsRecomputed: 0,
      groupStatsRecomputed: 0,
      consumers: {
        bySlot: {
          bottle_alias: 0,
          bottle_observation: 0,
          tasting: 0,
          review: 0,
          collection_bottle: 0,
          flight_bottle: 0,
          store_price: 0,
          incoming_bottle_decision_log: 0,
          "store_price_match_proposal.current": 0,
          "store_price_match_proposal.suggested": 0,
          "store_price_match_attempt.current": 0,
          "store_price_match_attempt.suggested": 0,
        },
        total: 0,
      },
    });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, retired.id),
      }),
    ).toEqual(bottleBefore);
    expect(
      await db
        .select()
        .from(bottleAliases)
        .where(eq(bottleAliases.bottleId, retired.id)),
    ).toEqual(aliasesBefore);
    expect(await db.select().from(bottleGroups)).toEqual([]);
    expect(await db.select().from(bottleReleasePromotions)).toEqual([]);
  });

  test("rejects a retired release-bearing parent without writing", async ({
    fixtures,
  }) => {
    const retired = await fixtures.LegacyBottle({
      fullName: "Migration Retired Release Family",
    });
    await fixtures.BottleRelease({
      bottleId: retired.id,
      fullName: "Migration Retired Release Family 2026",
    });
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: null,
    });
    const input = await approvedInput();
    expect(input.candidate.audit).toMatchObject({
      legacyCatalog: { retiredParentsWithReleases: 1 },
    });
    expect(input.candidate.audit.blockingIssueCount).toBeGreaterThan(0);
    const bottleBefore = await db.query.bottles.findFirst({
      where: eq(bottles.id, retired.id),
    });

    const error = await waitError(applyCatalogMigration(input));

    expect(error).toBeInstanceOf(CatalogMigrationApplyError);
    expect(error).toMatchObject({ code: "audit_blocked" });
    expect(
      await db.query.bottles.findFirst({
        where: eq(bottles.id, retired.id),
      }),
    ).toEqual(bottleBefore);
    expect(await db.select().from(bottleGroups)).toEqual([]);
    expect(await db.select().from(bottleReleasePromotions)).toEqual([]);
    expect(await db.select().from(bottles)).toHaveLength(1);
  });

  test("rejects collision and invalid-pair audits without writing", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      fullName: "Migration Collision",
    });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      fullName: parent.fullName,
    });
    const mismatchedParent = await fixtures.LegacyBottle({
      fullName: "Migration Mismatch",
    });
    await fixtures.Tasting({
      bottleId: mismatchedParent.id,
      releaseId: release.id,
    });
    const input = await approvedInput();

    const error = await waitError(applyCatalogMigration(input));

    expect(error).toBeInstanceOf(CatalogMigrationApplyError);
    expect(error).toMatchObject({ code: "audit_blocked" });
    expect(await db.select().from(bottleGroups)).toEqual([]);
    expect(await db.select().from(bottleReleasePromotions)).toEqual([]);
    expect(
      await db
        .select({ id: bottles.id, groupId: bottles.groupId })
        .from(bottles)
        .where(inArray(bottles.id, [parent.id, mismatchedParent.id]))
        .orderBy(asc(bottles.id)),
    ).toEqual([
      { id: parent.id, groupId: null },
      { id: mismatchedParent.id, groupId: null },
    ]);
  });

  test("rejects pre-lock drift from the approved audit before writing", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      fullName: "Migration Drift",
    });
    const release = await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Migration Drift 2026",
      fullName: "Migration Drift 2026",
    });
    const input = await approvedInput();
    await db.insert(bottleAliases).values({
      bottleId: parent.id,
      releaseId: release.id,
      name: release.fullName,
      assignedByActorId: release.createdByActorId,
    });

    const error = await waitError(applyCatalogMigration(input));

    expect(error).toBeInstanceOf(CatalogMigrationApplyError);
    expect(error).toMatchObject({ code: "audit_changed" });
    expect(await db.select().from(bottleGroups)).toEqual([]);
    expect(await db.select().from(bottleReleasePromotions)).toEqual([]);
    expect(
      await db
        .select({ groupId: bottles.groupId })
        .from(bottles)
        .where(eq(bottles.id, parent.id)),
    ).toEqual([{ groupId: null }]);
  });

  test("preflight rejects a recovery server before the authoritative transaction", async () => {
    const input = await approvedInput();
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            databaseName: "peated",
            systemIdentifier:
              input.candidate.revision.databaseEvidence.identity
                .systemIdentifier,
            isInRecovery: true,
            serverAddress: "10.0.0.2",
            serverPort: 5432,
            currentUser: "catalog_writer",
          },
        ],
      });
    const transaction = vi.fn(
      async <T>(callback: (tx: AnyTransaction) => Promise<T>): Promise<T> =>
        await callback({ execute } as unknown as AnyTransaction),
    );
    const standbyDatabase = { transaction } as unknown as AnyConnection;

    const error = await waitError(
      applyCatalogMigration(input, standbyDatabase),
    );

    expect(error).toBeInstanceOf(CatalogMigrationDatabaseEvidenceError);
    expect(error).toMatchObject({ code: "database_in_recovery" });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  test("authoritative transaction locks before loading its database evidence", async () => {
    const input = await approvedInput();
    const identityRow = {
      databaseName:
        input.candidate.revision.databaseEvidence.identity.databaseName,
      systemIdentifier:
        input.candidate.revision.databaseEvidence.identity.systemIdentifier,
      isInRecovery: false,
      serverAddress: "10.0.0.2",
      serverPort: 5432,
      currentUser: "catalog_writer",
    };
    const preflightExecute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [identityRow] });
    const authoritativeFailure = Object.assign(
      new Error("forced evidence failure"),
      { code: "ECONNRESET" },
    );
    const authoritativeExecute = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(authoritativeFailure);
    let transactionCount = 0;
    const transaction = vi.fn(
      async <T>(callback: (tx: AnyTransaction) => Promise<T>): Promise<T> => {
        transactionCount += 1;
        const execute =
          transactionCount === 1 ? preflightExecute : authoritativeExecute;
        return await callback({ execute } as unknown as AnyTransaction);
      },
    );
    const testDatabase = { transaction } as unknown as AnyConnection;

    const error = await waitError(applyCatalogMigration(input, testDatabase));

    expect(error).toBeInstanceOf(CatalogMigrationDatabaseEvidenceError);
    expect(error).toMatchObject({
      code: "database_identity_unavailable",
      cause: authoritativeFailure,
    });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(preflightExecute).toHaveBeenCalledTimes(2);
    expect(authoritativeExecute).toHaveBeenCalledTimes(3);
  });

  test("rolls back earlier family writes when a late mapping write fails", async ({
    fixtures,
  }) => {
    const parent = await fixtures.LegacyBottle({
      name: "Migration Rollback",
      fullName: "Migration Brand Rollback",
    });
    await fixtures.BottleRelease({
      bottleId: parent.id,
      name: "Migration Rollback 2026",
      fullName: "Migration Brand Rollback 2026",
    });
    const input = await approvedInput();
    const failure = new Error("forced late promotion mapping failure");
    const failingDatabase = {
      transaction: async <T>(
        callback: (tx: AnyTransaction) => Promise<T>,
      ): Promise<T> =>
        await db.transaction(async (tx) => {
          const wrapped = new Proxy(tx, {
            get(target, property, receiver) {
              if (property === "insert") {
                return (table: unknown) => {
                  if (table === bottleReleasePromotions) throw failure;
                  return target.insert(
                    table as Parameters<typeof target.insert>[0],
                  );
                };
              }
              const value = Reflect.get(target, property, receiver) as unknown;
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
          return await callback(wrapped);
        }),
    } as AnyConnection;

    await expect(applyCatalogMigration(input, failingDatabase)).rejects.toBe(
      failure,
    );

    expect(await db.select().from(bottleGroups)).toEqual([]);
    expect(await db.select().from(bottleReleasePromotions)).toEqual([]);
    expect(await db.select().from(bottles)).toEqual([
      expect.objectContaining({ id: parent.id, groupId: null }),
    ]);
  });
});
