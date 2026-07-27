import {
  CatalogMigrationApplyInputSchema,
  CatalogMigrationApplyResultSchema,
  CatalogMigrationApprovalCandidateSchema,
} from "./catalogMigrationApply";

const revision = {
  gitRevision: "a".repeat(40),
  databaseName: "peated",
  databaseMigration: {
    id: 193,
    hash: "migration-hash",
    createdAt: 1_700_000_000_000,
  },
};

const audit = {
  schemaVersion: 3,
  generatedAt: "2026-07-27T00:00:00.000Z",
  databaseName: "peated",
  legacyCatalog: {
    totalParents: 1,
    parentsWithZeroReleases: 1,
    parentsWithOneRelease: 0,
    parentsWithMultipleReleases: 0,
    totalReleases: 0,
    retiredParents: 0,
    retiredParentsWithReleases: 0,
    parentsWithReleaseLikeFields: 0,
    childParentAgeConflicts: 0,
    orphanReleases: 0,
    missingParentCreators: 0,
    missingReleaseCreators: 0,
    missingParentAliases: 0,
    missingReleaseAliases: 0,
    missingParentImages: 0,
    missingReleaseImages: 0,
  },
  references: [],
  collisions: { count: 0, items: [] },
  promotionMappings: {
    tablePresent: true,
    totalLegacyReleases: 0,
    totalMappings: 0,
    mappedReleases: 0,
    unmappedReleases: 0,
    completedMappings: 0,
    pendingMappings: 0,
    failedMappings: 0,
    partialMappings: 0,
    invalidStatusMappings: 0,
    duplicateReleaseMappings: 0,
    missingLegacyReleases: 0,
    missingPromotedBottles: 0,
  },
  blockingIssueCount: 0,
  warningCount: 0,
};

const consumerBySlot = {
  bottle_alias: 0,
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
};

describe("CatalogMigration approval and apply schemas", () => {
  test("parses the retained approval candidate and apply input", () => {
    const candidate = CatalogMigrationApprovalCandidateSchema.parse({
      schemaVersion: 1,
      audit,
      revision,
    });

    expect(
      CatalogMigrationApplyInputSchema.parse({
        candidate,
        approval: {
          approvedBy: "operator@example.com",
          approvedAt: "2026-07-27T00:01:00.000Z",
        },
      }),
    ).toMatchObject({
      candidate,
      approval: { approvedBy: "operator@example.com" },
    });
  });

  test("requires consumer totals to equal the per-slot sum", () => {
    const baseResult = {
      schemaVersion: 2,
      status: "applied",
      approvedAuditGeneratedAt: audit.generatedAt,
      revision,
      approval: {
        approvedBy: "operator@example.com",
        approvedAt: "2026-07-27T00:01:00.000Z",
      },
      startedAt: "2026-07-27T00:02:00.000Z",
      completedAt: "2026-07-27T00:03:00.000Z",
      counts: {
        parents: 1,
        groups: 1,
        parentBottlesAssigned: 1,
        releases: 1,
        promotedBottles: 1,
        promotionMappings: 1,
        canonicalAliasesChanged: 2,
        canonicalAliasesReused: 0,
        groupDistillers: 1,
        bottleDistillers: 1,
        bottleTags: 0,
        bottleFlavorProfiles: 0,
        bottleStatsRecomputed: 2,
        groupStatsRecomputed: 1,
        consumers: {
          bySlot: consumerBySlot,
          total: 1,
        },
      },
      postflightAudit: audit,
    };

    expect(
      CatalogMigrationApplyResultSchema.safeParse(baseResult).success,
    ).toBe(true);
    expect(CatalogMigrationApplyResultSchema.parse(baseResult).counts).toEqual(
      baseResult.counts,
    );
    for (const field of [
      "bottleStatsRecomputed",
      "groupStatsRecomputed",
    ] as const) {
      const { [field]: _missing, ...counts } = baseResult.counts;
      expect(
        CatalogMigrationApplyResultSchema.safeParse({
          ...baseResult,
          counts,
        }).success,
      ).toBe(false);
    }
    expect(
      CatalogMigrationApplyResultSchema.parse({
        ...baseResult,
        status: "already_complete",
        counts: {
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
            bySlot: Object.fromEntries(
              Object.keys(consumerBySlot).map((slot) => [slot, 0]),
            ),
            total: 0,
          },
        },
      }).counts,
    ).toEqual({
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
        bySlot: Object.fromEntries(
          Object.keys(consumerBySlot).map((slot) => [slot, 0]),
        ),
        total: 0,
      },
    });
    expect(
      CatalogMigrationApplyResultSchema.safeParse({
        ...baseResult,
        counts: {
          ...baseResult.counts,
          consumers: { bySlot: consumerBySlot, total: 2 },
        },
      }).success,
    ).toBe(false);
  });
});
