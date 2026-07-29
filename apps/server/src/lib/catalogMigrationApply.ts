/**
 * Owns the one-shot legacy BottleRelease migration. The complete catalog is
 * planned under a fixed table lock set, then committed or rolled back as one
 * transaction without invoking runtime queues or target compatibility.
 */
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db, type AnyConnection, type AnyTransaction } from "../db";
import {
  bottleAliases,
  bottleFlavorProfiles,
  bottleGroupDistillers,
  bottleGroups,
  bottleReleasePromotions,
  bottleReleases,
  bottles,
  bottlesToDistillers,
  bottleTags,
  bottleTombstones,
  type Bottle,
  type BottleRelease,
} from "../db/schema";
import {
  CATALOG_MIGRATION_APPLY_SCHEMA_VERSION,
  CatalogMigrationApplyInputSchema,
  CatalogMigrationApplyResultSchema,
  CatalogMigrationConsumerResultSchema,
  type CatalogMigrationApplyResult,
  type CatalogMigrationApprovalCandidate,
  type CatalogMigrationRevisionEvidence,
} from "../schemas/catalogMigrationApply";
import { sameCatalogMigrationDatabaseIdentity } from "../schemas/catalogMigrationDatabaseIdentity";
import {
  ExactBottleAliasConflictError,
  reserveExactBottleAliasInTransaction,
  reserveLiteralCanonicalBottleAliasInTransaction,
} from "./bottleAliases";
import { collectCatalogMigrationAudit } from "./catalogMigrationAudit";
import {
  assertLegacyConsumersPromotedInTransaction,
  preflightLegacyConsumersInTransaction,
  repointLegacyConsumersInTransaction,
  type CatalogMigrationConsumerResult,
} from "./catalogMigrationConsumers";
import { loadCatalogMigrationDatabaseEvidence } from "./catalogMigrationDatabaseEvidence";
import { loadCatalogMigrationRevisionEvidenceInTransaction } from "./catalogMigrationRevision";
import {
  assertCatalogMigrationStatsInTransaction,
  recomputeCatalogMigrationStatsInTransaction,
  type CatalogMigrationStatsFamily,
  type CatalogMigrationStatsResult,
} from "./catalogMigrationStats";
import { normalizeBottleAliasKey } from "./normalize";

const EMPTY_CONSUMER_RESULT = {
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
} as const satisfies CatalogMigrationConsumerResult;

export type CatalogMigrationApplyErrorCode =
  | "approval_invalid"
  | "audit_blocked"
  | "audit_changed"
  | "revision_changed"
  | "partial_state"
  | "name_collision"
  | "alias_collision"
  | "family_changed"
  | "postflight_failed";

export class CatalogMigrationApplyError extends Error {
  constructor(
    readonly code: CatalogMigrationApplyErrorCode,
    readonly details: Record<string, unknown> = {},
    options?: ErrorOptions,
  ) {
    super(
      `Catalog migration apply failed (${code}): ${JSON.stringify(details)}`,
      options,
    );
    this.name = "CatalogMigrationApplyError";
  }
}

type ParentOwnedRows = {
  distillerIds: number[];
  tags: Array<{ tag: string; count: number }>;
  flavorProfiles: Array<
    Pick<typeof bottleFlavorProfiles.$inferSelect, "flavorProfile" | "count">
  >;
};

type FamilyPlan = {
  parent: Bottle;
  releases: BottleRelease[];
  ownedRows: ParentOwnedRows;
  groupKey: string;
  sharedParentIdentity: boolean;
};

type MigrationState = {
  bottles: Bottle[];
  releases: BottleRelease[];
  mappings: Array<typeof bottleReleasePromotions.$inferSelect>;
};

type AppliedFamily = {
  plan: FamilyPlan;
  groupId: number;
  representativeParentId: number;
  groupTotalBottles: number;
  groupDistillerIds: number[];
  promoted: Array<{
    release: BottleRelease;
    bottle: Bottle;
  }>;
};

type CoreCounts = Omit<CatalogMigrationApplyResult["counts"], "consumers">;

const ZERO_CORE_COUNTS: CoreCounts = {
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
};

function sameRevision(
  left: CatalogMigrationRevisionEvidence,
  right: CatalogMigrationRevisionEvidence,
) {
  return (
    left.gitRevision === right.gitRevision &&
    sameCatalogMigrationDatabaseIdentity(
      left.databaseEvidence.identity,
      right.databaseEvidence.identity,
    ) &&
    left.databaseMigration.id === right.databaseMigration.id &&
    left.databaseMigration.hash === right.databaseMigration.hash &&
    left.databaseMigration.createdAt === right.databaseMigration.createdAt
  );
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }
  if (
    (Array.isArray(left) && Array.isArray(right)) ||
    (left !== null &&
      right !== null &&
      typeof left === "object" &&
      typeof right === "object" &&
      !(left instanceof Date) &&
      !(right instanceof Date))
  ) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return left === right;
}

function firstRow<T>(rows: T[], label: string): T {
  const row = rows[0];
  if (!row) {
    throw new CatalogMigrationApplyError("audit_changed", {
      reason: `${label}_missing`,
    });
  }
  return row;
}

/**
 * Rejects an obvious standby before opening the authoritative transaction.
 * This disposable read-only check is not retained or reused as migration
 * evidence; the locked transaction reloads its own database evidence.
 */
async function assertWritablePrimaryPreflight(
  database: AnyConnection,
): Promise<void> {
  await database.transaction(async (tx) => {
    await tx.execute(sql`SET TRANSACTION READ ONLY`);
    await loadCatalogMigrationDatabaseEvidence(tx);
  });
}

/**
 * SHARE ROW EXCLUSIVE permits retained read-only inspection while preventing
 * every application writer from drifting identity after the approved audit.
 * The alphabetical order is stable across the CLI and integration tests.
 */
async function lockMigrationTables(tx: AnyTransaction): Promise<void> {
  await tx.execute(
    sql.raw(`
    LOCK TABLE
      __drizzle_migrations,
      bottle,
      bottle_alias,
      bottle_distiller,
      bottle_flavor_profile,
      bottle_group,
      bottle_group_distiller,
      bottle_observation,
      bottle_release,
      bottle_release_promotion,
      bottle_tag,
      bottle_tombstone,
      collection_bottle,
      flight_bottle,
      incoming_bottle_decision_log,
      review,
      store_price,
      store_price_match_attempt,
      store_price_match_proposal,
      tasting
    IN SHARE ROW EXCLUSIVE MODE
  `),
  );
}

async function loadMigrationState(tx: AnyTransaction): Promise<MigrationState> {
  const bottleRows = await tx
    .select({ bottle: bottles })
    .from(bottles)
    .leftJoin(bottleTombstones, eq(bottleTombstones.bottleId, bottles.id))
    .where(isNull(bottleTombstones.bottleId))
    .orderBy(asc(bottles.id));
  const releases = await tx
    .select()
    .from(bottleReleases)
    .orderBy(asc(bottleReleases.id));
  const mappings = await tx
    .select()
    .from(bottleReleasePromotions)
    .orderBy(asc(bottleReleasePromotions.releaseId));
  return {
    bottles: bottleRows.map(({ bottle }) => bottle),
    releases,
    mappings,
  };
}

function assertApprovedPreflight(
  approved: CatalogMigrationApprovalCandidate,
  revision: CatalogMigrationRevisionEvidence,
): void {
  if (!sameRevision(approved.revision, revision)) {
    throw new CatalogMigrationApplyError("revision_changed", {
      approved: approved.revision,
      current: revision,
    });
  }
  if (
    approved.audit.blockingIssueCount !== 0 ||
    approved.audit.collisions.count !== 0
  ) {
    throw new CatalogMigrationApplyError("audit_blocked", {
      blockingIssueCount: approved.audit.blockingIssueCount,
      collisionCount: approved.audit.collisions.count,
    });
  }
  if (
    !approved.audit.promotionMappings.tablePresent ||
    approved.audit.promotionMappings.totalMappings !== 0
  ) {
    throw new CatalogMigrationApplyError("partial_state", {
      promotionMappings: approved.audit.promotionMappings,
    });
  }
}

async function assertAuditUnchanged(
  tx: AnyTransaction,
  candidate: CatalogMigrationApprovalCandidate,
  revision: CatalogMigrationRevisionEvidence,
): Promise<void> {
  const current = await collectCatalogMigrationAudit(
    tx,
    revision.databaseEvidence,
  );
  const {
    generatedAt: _approvedGeneratedAt,
    databaseEvidence: {
      connection: _approvedConnection,
      ...approvedDatabaseEvidence
    },
    ...approvedAudit
  } = candidate.audit;
  const {
    generatedAt: _currentGeneratedAt,
    databaseEvidence: {
      connection: _currentConnection,
      ...currentDatabaseEvidence
    },
    ...currentAudit
  } = current;
  const approvedSnapshot = {
    ...approvedAudit,
    databaseEvidence: approvedDatabaseEvidence,
  };
  const currentSnapshot = {
    ...currentAudit,
    databaseEvidence: currentDatabaseEvidence,
  };
  if (JSON.stringify(currentSnapshot) !== JSON.stringify(approvedSnapshot)) {
    throw new CatalogMigrationApplyError("audit_changed", {
      approved: approvedSnapshot,
      current: currentSnapshot,
    });
  }
}

function materializedBottle(
  parent: Bottle,
  release: BottleRelease,
  groupId: number,
): typeof bottles.$inferInsert {
  return {
    groupId,
    name: release.name,
    fullName: release.fullName,
    statedAge: release.statedAge ?? parent.statedAge,
    seriesId: parent.seriesId,
    category: parent.category,
    brandId: parent.brandId,
    bottlerId: parent.bottlerId,
    flavorProfile: parent.flavorProfile,
    edition: release.edition,
    abv: release.abv,
    singleCask: release.singleCask,
    caskStrength: release.caskStrength,
    vintageYear: release.vintageYear,
    releaseYear: release.releaseYear,
    caskSize: release.caskSize,
    caskType: release.caskType,
    caskFill: release.caskFill,
    description: release.description ?? parent.description,
    descriptionSrc:
      release.description === null
        ? parent.descriptionSrc
        : release.descriptionSrc,
    imageUrl: release.imageUrl?.trim() ? release.imageUrl : parent.imageUrl,
    tastingNotes: release.tastingNotes ?? parent.tastingNotes,
    suggestedTags: release.suggestedTags.length
      ? release.suggestedTags
      : parent.suggestedTags,
    avgRating: release.avgRating,
    totalTastings: release.totalTastings,
    searchVector: release.searchVector,
    createdAt: release.createdAt,
    updatedAt: release.updatedAt,
    createdByActorId: release.createdByActorId,
  };
}

const MATERIALIZED_BOTTLE_FIELDS = [
  "groupId",
  "name",
  "fullName",
  "statedAge",
  "seriesId",
  "category",
  "brandId",
  "bottlerId",
  "flavorProfile",
  "edition",
  "abv",
  "singleCask",
  "caskStrength",
  "vintageYear",
  "releaseYear",
  "caskSize",
  "caskType",
  "caskFill",
  "description",
  "descriptionSrc",
  "imageUrl",
  "tastingNotes",
  "suggestedTags",
  "searchVector",
  "createdAt",
  "updatedAt",
  "createdByActorId",
] as const satisfies ReadonlyArray<keyof Bottle>;

function assertBottleMaterialization(
  parent: Bottle,
  release: BottleRelease,
  bottle: Bottle,
  groupId: number,
): void {
  const expected = materializedBottle(parent, release, groupId);
  const mismatches = MATERIALIZED_BOTTLE_FIELDS.filter(
    (field) => !sameValue(bottle[field], expected[field]),
  );
  if (mismatches.length) {
    throw new CatalogMigrationApplyError("postflight_failed", {
      parentId: parent.id,
      releaseId: release.id,
      bottleId: bottle.id,
      mismatches,
    });
  }
}

function claimKey(name: string): string {
  return name.trim().toLowerCase();
}

function canonicalNames(name: string): string[] {
  return [...new Set([name.trim(), normalizeBottleAliasKey(name)])];
}

async function buildFamilyPlans(
  tx: AnyTransaction,
  state: MigrationState,
): Promise<FamilyPlan[]> {
  const parentById = new Map(
    state.bottles.map((bottle) => [bottle.id, bottle]),
  );
  const releasesByParentId = new Map<number, BottleRelease[]>();
  for (const release of state.releases) {
    if (!parentById.has(release.bottleId)) {
      throw new CatalogMigrationApplyError("family_changed", {
        releaseId: release.id,
        parentId: release.bottleId,
        reason: "parent_missing",
      });
    }
    const familyReleases = releasesByParentId.get(release.bottleId) ?? [];
    familyReleases.push(release);
    releasesByParentId.set(release.bottleId, familyReleases);
  }

  const distillers = await tx
    .select()
    .from(bottlesToDistillers)
    .orderBy(
      asc(bottlesToDistillers.bottleId),
      asc(bottlesToDistillers.distillerId),
    );
  const tags = await tx
    .select()
    .from(bottleTags)
    .orderBy(asc(bottleTags.bottleId), asc(bottleTags.tag));
  const flavorProfiles = await tx
    .select()
    .from(bottleFlavorProfiles)
    .orderBy(
      asc(bottleFlavorProfiles.bottleId),
      asc(bottleFlavorProfiles.flavorProfile),
    );
  const aliases = await tx
    .select()
    .from(bottleAliases)
    .orderBy(asc(bottleAliases.name));
  const distillerIdsByBottleId = new Map<number, number[]>();
  for (const { bottleId, distillerId } of distillers) {
    const owned = distillerIdsByBottleId.get(bottleId) ?? [];
    owned.push(distillerId);
    distillerIdsByBottleId.set(bottleId, owned);
  }
  const tagsByBottleId = new Map<number, ParentOwnedRows["tags"]>();
  for (const { bottleId, tag, count } of tags) {
    const owned = tagsByBottleId.get(bottleId) ?? [];
    owned.push({ tag, count });
    tagsByBottleId.set(bottleId, owned);
  }
  const flavorProfilesByBottleId = new Map<
    number,
    ParentOwnedRows["flavorProfiles"]
  >();
  for (const { bottleId, flavorProfile, count } of flavorProfiles) {
    const owned = flavorProfilesByBottleId.get(bottleId) ?? [];
    owned.push({ flavorProfile, count });
    flavorProfilesByBottleId.set(bottleId, owned);
  }

  const bottleByCanonicalName = new Map<string, Bottle[]>();
  for (const bottle of state.bottles) {
    const key = claimKey(bottle.fullName);
    const matchingBottles = bottleByCanonicalName.get(key) ?? [];
    matchingBottles.push(bottle);
    bottleByCanonicalName.set(key, matchingBottles);
  }
  const aliasByName = new Map(
    aliases.map((alias) => [claimKey(alias.name), alias]),
  );
  const groupParentByParentId = new Map(
    state.bottles.map((parent) => [parent.id, parent.id]),
  );
  const findGroupParent = (parentId: number): number => {
    const groupParentId = groupParentByParentId.get(parentId);
    if (groupParentId === undefined) return parentId;
    if (groupParentId === parentId) return groupParentId;
    const rootParentId = findGroupParent(groupParentId);
    groupParentByParentId.set(parentId, rootParentId);
    return rootParentId;
  };
  const unionParentGroups = (leftParentId: number, rightParentId: number) => {
    const leftRoot = findGroupParent(leftParentId);
    const rightRoot = findGroupParent(rightParentId);
    if (leftRoot === rightRoot) return;
    const [representativeId, joinedId] = [leftRoot, rightRoot].sort(
      (left, right) => left - right,
    );
    groupParentByParentId.set(joinedId, representativeId);
  };
  const parentIdsByLiteralName = new Map<string, number[]>();
  const parentIdsByCanonicalName = new Map<string, number[]>();
  for (const parent of state.bottles) {
    const literalKey = claimKey(parent.fullName);
    const literalParentIds = parentIdsByLiteralName.get(literalKey) ?? [];
    literalParentIds.push(parent.id);
    parentIdsByLiteralName.set(literalKey, literalParentIds);
    for (const name of canonicalNames(parent.fullName)) {
      const key = claimKey(name);
      const canonicalParentIds = parentIdsByCanonicalName.get(key) ?? [];
      canonicalParentIds.push(parent.id);
      parentIdsByCanonicalName.set(key, canonicalParentIds);
    }
  }
  for (const parentIds of parentIdsByLiteralName.values()) {
    const [firstParentId, ...duplicateParentIds] = parentIds;
    if (firstParentId === undefined) continue;
    for (const duplicateParentId of duplicateParentIds) {
      unionParentGroups(firstParentId, duplicateParentId);
    }
  }
  for (const alias of aliases) {
    if (
      alias.ignored === true ||
      alias.releaseId !== null ||
      alias.bottleId === null ||
      !parentById.has(alias.bottleId)
    ) {
      continue;
    }
    for (const matchingParentId of parentIdsByCanonicalName.get(
      claimKey(alias.name),
    ) ?? []) {
      unionParentGroups(alias.bottleId, matchingParentId);
    }
  }
  const groupKeyByParentId = new Map(
    state.bottles.map((parent) => [
      parent.id,
      `parent:${findGroupParent(parent.id)}`,
    ]),
  );
  const parentCountByGroupKey = new Map<string, number>();
  for (const groupKey of groupKeyByParentId.values()) {
    parentCountByGroupKey.set(
      groupKey,
      (parentCountByGroupKey.get(groupKey) ?? 0) + 1,
    );
  }
  const plannedClaimByName = new Map<
    string,
    {
      bottleId: number | null;
      parentId: number;
      releaseId: number | null;
      groupKey: string;
    }
  >();
  const claimCanonicalIdentity = ({
    fullName,
    bottleId,
    parentId,
    releaseId,
  }: {
    fullName: string;
    bottleId: number | null;
    parentId: number;
    releaseId: number | null;
  }) => {
    const groupKey = groupKeyByParentId.get(parentId);
    if (!groupKey) {
      throw new CatalogMigrationApplyError("family_changed", {
        parentId,
        reason: "parent_group_key_missing",
      });
    }
    for (const name of canonicalNames(fullName)) {
      const key = claimKey(name);
      const planned = plannedClaimByName.get(key);
      if (
        planned &&
        (planned.parentId !== parentId || planned.releaseId !== releaseId) &&
        !(
          planned.releaseId === null &&
          releaseId === null &&
          planned.groupKey === groupKey
        )
      ) {
        throw new CatalogMigrationApplyError("name_collision", {
          name,
          parentId,
          releaseId,
          conflictingParentId: planned.parentId,
          conflictingReleaseId: planned.releaseId,
        });
      }
      plannedClaimByName.set(key, {
        bottleId,
        parentId,
        releaseId,
        groupKey,
      });

      const canonicalCollision = (bottleByCanonicalName.get(key) ?? []).find(
        (bottle) =>
          releaseId !== null ||
          (bottle.id !== parentId &&
            groupKeyByParentId.get(bottle.id) !== groupKey),
      );
      if (canonicalCollision) {
        throw new CatalogMigrationApplyError("name_collision", {
          name,
          parentId,
          releaseId,
          conflictingBottleId: canonicalCollision.id,
        });
      }

      const alias = aliasByName.get(key);
      if (!alias) continue;
      const aliasParentGroupKey =
        alias.releaseId === null && alias.bottleId !== null
          ? groupKeyByParentId.get(alias.bottleId)
          : undefined;
      const unassigned = alias.bottleId === null && alias.releaseId === null;
      const owned =
        unassigned ||
        (releaseId === null
          ? alias.releaseId === null &&
            (alias.bottleId === parentId ||
              ((parentCountByGroupKey.get(groupKey) ?? 0) > 1 &&
                aliasParentGroupKey === groupKey))
          : (alias.releaseId === releaseId &&
              (alias.bottleId === parentId || alias.bottleId === null)) ||
            (alias.releaseId === null && alias.bottleId === parentId));
      if (!owned || alias.ignored === true) {
        throw new CatalogMigrationApplyError("alias_collision", {
          name,
          parentId,
          releaseId,
          aliasBottleId: alias.bottleId,
          aliasReleaseId: alias.releaseId,
          aliasIgnored: alias.ignored,
        });
      }
    }
  };

  for (const parent of state.bottles) {
    claimCanonicalIdentity({
      fullName: parent.fullName,
      bottleId: parent.id,
      parentId: parent.id,
      releaseId: null,
    });
    for (const release of releasesByParentId.get(parent.id) ?? []) {
      claimCanonicalIdentity({
        fullName: release.fullName,
        bottleId: null,
        parentId: parent.id,
        releaseId: release.id,
      });
    }
  }

  return state.bottles.map((parent) => {
    const groupKey = groupKeyByParentId.get(parent.id)!;
    return {
      parent,
      releases: releasesByParentId.get(parent.id) ?? [],
      ownedRows: {
        distillerIds: distillerIdsByBottleId.get(parent.id) ?? [],
        tags: tagsByBottleId.get(parent.id) ?? [],
        flavorProfiles: flavorProfilesByBottleId.get(parent.id) ?? [],
      },
      groupKey,
      sharedParentIdentity: (parentCountByGroupKey.get(groupKey) ?? 0) > 1,
    };
  });
}

function groupValues(
  plan: FamilyPlan,
  totalBottles: number,
): typeof bottleGroups.$inferInsert {
  const { parent } = plan;
  return {
    fullName: parent.fullName,
    name: parent.name,
    statedAge: parent.statedAge,
    seriesId: parent.seriesId,
    category: parent.category,
    brandId: parent.brandId,
    bottlerId: parent.bottlerId,
    flavorProfile: parent.flavorProfile,
    totalBottles,
    createdAt: parent.createdAt,
    updatedAt: parent.updatedAt,
    createdByActorId: parent.createdByActorId,
  };
}

async function insertGroup(
  tx: AnyTransaction,
  plans: FamilyPlan[],
): Promise<AppliedFamily[]> {
  const representativePlan = plans[0];
  if (!representativePlan) return [];
  const totalBottles = plans.reduce(
    (total, plan) => total + plan.releases.length + 1,
    0,
  );
  const groupDistillerIds = [
    ...new Set(plans.flatMap((plan) => plan.ownedRows.distillerIds)),
  ].sort((left, right) => left - right);
  const [group] = await tx
    .insert(bottleGroups)
    .values(groupValues(representativePlan, totalBottles))
    .returning();
  if (!group) {
    throw new CatalogMigrationApplyError("postflight_failed", {
      parentId: representativePlan.parent.id,
      reason: "group_insert_missing",
    });
  }

  if (groupDistillerIds.length) {
    await tx.insert(bottleGroupDistillers).values(
      groupDistillerIds.map((distillerId) => ({
        groupId: group.id,
        distillerId,
      })),
    );
  }

  const applied: AppliedFamily[] = [];
  for (const plan of plans) {
    const [assignedParent] = await tx
      .update(bottles)
      .set({ groupId: group.id })
      .where(and(eq(bottles.id, plan.parent.id), isNull(bottles.groupId)))
      .returning({ id: bottles.id });
    if (!assignedParent) {
      throw new CatalogMigrationApplyError("family_changed", {
        parentId: plan.parent.id,
        reason: "parent_assignment_changed",
      });
    }
    const promoted: AppliedFamily["promoted"] = [];
    for (const release of plan.releases) {
      const [bottle] = await tx
        .insert(bottles)
        .values(materializedBottle(plan.parent, release, group.id))
        .returning();
      if (!bottle) {
        throw new CatalogMigrationApplyError("postflight_failed", {
          parentId: plan.parent.id,
          releaseId: release.id,
          reason: "promoted_bottle_insert_missing",
        });
      }
      if (plan.ownedRows.distillerIds.length) {
        await tx.insert(bottlesToDistillers).values(
          plan.ownedRows.distillerIds.map((distillerId) => ({
            bottleId: bottle.id,
            distillerId,
          })),
        );
      }
      if (plan.ownedRows.tags.length) {
        await tx
          .insert(bottleTags)
          .values(
            plan.ownedRows.tags.map((tag) => ({ bottleId: bottle.id, ...tag })),
          );
      }
      if (plan.ownedRows.flavorProfiles.length) {
        await tx.insert(bottleFlavorProfiles).values(
          plan.ownedRows.flavorProfiles.map((profile) => ({
            bottleId: bottle.id,
            ...profile,
          })),
        );
      }
      await tx.insert(bottleReleasePromotions).values({
        releaseId: release.id,
        promotedBottleId: bottle.id,
      });
      promoted.push({ release, bottle });
    }
    applied.push({
      plan,
      groupId: group.id,
      representativeParentId: representativePlan.parent.id,
      groupTotalBottles: totalBottles,
      groupDistillerIds,
      promoted,
    });
  }

  const [represented] = await tx
    .update(bottleGroups)
    .set({ representativeBottleId: representativePlan.parent.id })
    .where(eq(bottleGroups.id, group.id))
    .returning({ id: bottleGroups.id });
  if (!represented) {
    throw new CatalogMigrationApplyError("postflight_failed", {
      parentId: representativePlan.parent.id,
      groupId: group.id,
      reason: "representative_update_missing",
    });
  }

  return applied;
}

function statsFamilies(
  applied: readonly AppliedFamily[],
): CatalogMigrationStatsFamily[] {
  const byGroupId = new Map<number, AppliedFamily[]>();
  for (const family of applied) {
    const groupFamilies = byGroupId.get(family.groupId) ?? [];
    groupFamilies.push(family);
    byGroupId.set(family.groupId, groupFamilies);
  }
  return [...byGroupId.entries()].map(([groupId, families]) => {
    const firstFamily = families[0]!;
    return {
      groupId,
      retainedParentBottleId: firstFamily.representativeParentId,
      promotedBottleIds: families.flatMap((family) => [
        ...(family.plan.parent.id === firstFamily.representativeParentId
          ? []
          : [family.plan.parent.id]),
        ...family.promoted.map(({ bottle }) => bottle.id),
      ]),
    };
  });
}

async function reserveCanonicalAliases(
  tx: AnyTransaction,
  applied: AppliedFamily[],
): Promise<{ changed: number; reused: number }> {
  let changed = 0;
  let reused = 0;
  const reserve = async (
    reservation:
      | typeof reserveExactBottleAliasInTransaction
      | typeof reserveLiteralCanonicalBottleAliasInTransaction,
    bottle: Pick<Bottle, "id" | "fullName" | "createdByActorId">,
  ) => {
    try {
      const result = await reservation(tx, {
        name: bottle.fullName,
        bottleId: bottle.id,
        assignmentSource: "canonical",
        assignedByActorId: bottle.createdByActorId,
      });
      if (result.changed) changed += 1;
      else reused += 1;
    } catch (error) {
      if (!(error instanceof ExactBottleAliasConflictError)) throw error;
      throw new CatalogMigrationApplyError(
        "alias_collision",
        {
          name: error.alias.name,
          bottleId: bottle.id,
          conflictingBottleId: error.conflictingBottleId,
        },
        { cause: error },
      );
    }
  };

  for (const family of applied) {
    if (!family.plan.sharedParentIdentity) {
      await reserve(reserveExactBottleAliasInTransaction, family.plan.parent);
      await reserve(
        reserveLiteralCanonicalBottleAliasInTransaction,
        family.plan.parent,
      );
    }
    for (const { bottle } of family.promoted) {
      for (const name of canonicalNames(bottle.fullName)) {
        const reassigned = await tx
          .update(bottleAliases)
          .set({
            bottleId: bottle.id,
            assignmentSource: "canonical",
            assignedByActorId: bottle.createdByActorId,
            embedding: null,
          })
          .where(
            and(
              eq(bottleAliases.bottleId, family.plan.parent.id),
              isNull(bottleAliases.releaseId),
              sql`LOWER(${bottleAliases.name}) = LOWER(${name})`,
            ),
          )
          .returning({ name: bottleAliases.name });
        changed += reassigned.length;
      }
      await reserve(reserveExactBottleAliasInTransaction, bottle);
      await reserve(reserveLiteralCanonicalBottleAliasInTransaction, bottle);
    }
  }
  return { changed, reused };
}

function emptyOwnedRows(): ParentOwnedRows {
  return {
    distillerIds: [],
    tags: [],
    flavorProfiles: [],
  };
}

async function loadBottleOwnedRowsByBottleId(
  tx: AnyTransaction,
): Promise<Map<number, ParentOwnedRows>> {
  const distillers = await tx
    .select()
    .from(bottlesToDistillers)
    .orderBy(
      asc(bottlesToDistillers.bottleId),
      asc(bottlesToDistillers.distillerId),
    );
  const tags = await tx
    .select()
    .from(bottleTags)
    .orderBy(asc(bottleTags.bottleId), asc(bottleTags.tag));
  const flavorProfiles = await tx
    .select()
    .from(bottleFlavorProfiles)
    .orderBy(
      asc(bottleFlavorProfiles.bottleId),
      asc(bottleFlavorProfiles.flavorProfile),
    );

  const ownedRowsByBottleId = new Map<number, ParentOwnedRows>();
  const getOwnedRows = (bottleId: number) => {
    const existing = ownedRowsByBottleId.get(bottleId);
    if (existing) return existing;
    const created = emptyOwnedRows();
    ownedRowsByBottleId.set(bottleId, created);
    return created;
  };
  for (const { bottleId, distillerId } of distillers) {
    getOwnedRows(bottleId).distillerIds.push(distillerId);
  }
  for (const { bottleId, tag, count } of tags) {
    getOwnedRows(bottleId).tags.push({ tag, count });
  }
  for (const { bottleId, flavorProfile, count } of flavorProfiles) {
    getOwnedRows(bottleId).flavorProfiles.push({ flavorProfile, count });
  }
  return ownedRowsByBottleId;
}

function assertCanonicalAliases(
  aliasByName: ReadonlyMap<
    string,
    Pick<
      typeof bottleAliases.$inferSelect,
      "bottleId" | "ignored" | "assignmentSource"
    >
  >,
  bottlesToCheck: Array<Pick<Bottle, "id" | "fullName">>,
): void {
  for (const bottle of bottlesToCheck) {
    for (const name of canonicalNames(bottle.fullName)) {
      const alias = aliasByName.get(name);
      if (
        !alias ||
        alias.bottleId !== bottle.id ||
        alias.ignored === true ||
        alias.assignmentSource !== "canonical"
      ) {
        throw new CatalogMigrationApplyError("postflight_failed", {
          bottleId: bottle.id,
          aliasName: name,
          reason: "canonical_alias_mismatch",
        });
      }
    }
  }
}

type AppliedFamilyPostflightState = {
  bottleById: ReadonlyMap<number, Bottle>;
  groupById: ReadonlyMap<number, typeof bottleGroups.$inferSelect>;
  mappingByReleaseId: ReadonlyMap<
    number,
    typeof bottleReleasePromotions.$inferSelect
  >;
  groupDistillerIdsByGroupId: ReadonlyMap<number, number[]>;
  ownedRowsByBottleId: ReadonlyMap<number, ParentOwnedRows>;
  aliasByName: ReadonlyMap<
    string,
    Pick<
      typeof bottleAliases.$inferSelect,
      "bottleId" | "ignored" | "assignmentSource"
    >
  >;
};

async function loadAppliedFamilyPostflightState(
  tx: AnyTransaction,
): Promise<AppliedFamilyPostflightState> {
  const bottleRows = await tx
    .select({ bottle: bottles })
    .from(bottles)
    .leftJoin(bottleTombstones, eq(bottleTombstones.bottleId, bottles.id))
    .where(isNull(bottleTombstones.bottleId))
    .orderBy(asc(bottles.id));
  const groups = await tx
    .select()
    .from(bottleGroups)
    .orderBy(asc(bottleGroups.id));
  const mappings = await tx
    .select()
    .from(bottleReleasePromotions)
    .orderBy(asc(bottleReleasePromotions.releaseId));
  const groupDistillers = await tx
    .select()
    .from(bottleGroupDistillers)
    .orderBy(
      asc(bottleGroupDistillers.groupId),
      asc(bottleGroupDistillers.distillerId),
    );
  const ownedRowsByBottleId = await loadBottleOwnedRowsByBottleId(tx);
  const aliases = await tx
    .select({
      name: bottleAliases.name,
      bottleId: bottleAliases.bottleId,
      ignored: bottleAliases.ignored,
      assignmentSource: bottleAliases.assignmentSource,
    })
    .from(bottleAliases)
    .orderBy(asc(bottleAliases.name));

  const groupDistillerIdsByGroupId = new Map<number, number[]>();
  for (const { groupId, distillerId } of groupDistillers) {
    const ids = groupDistillerIdsByGroupId.get(groupId) ?? [];
    ids.push(distillerId);
    groupDistillerIdsByGroupId.set(groupId, ids);
  }

  return {
    bottleById: new Map(bottleRows.map(({ bottle }) => [bottle.id, bottle])),
    groupById: new Map(groups.map((group) => [group.id, group])),
    mappingByReleaseId: new Map(
      mappings.map((mapping) => [mapping.releaseId, mapping]),
    ),
    groupDistillerIdsByGroupId,
    ownedRowsByBottleId,
    aliasByName: new Map(aliases.map(({ name, ...alias }) => [name, alias])),
  };
}

async function assertAppliedFamilies(
  tx: AnyTransaction,
  applied: AppliedFamily[],
): Promise<void> {
  const state = await loadAppliedFamilyPostflightState(tx);
  for (const family of applied) {
    const parent = state.bottleById.get(family.plan.parent.id);
    const group = state.groupById.get(family.groupId);
    if (
      !parent ||
      !group ||
      parent.groupId !== group.id ||
      group.representativeBottleId !== family.representativeParentId ||
      group.totalBottles !== family.groupTotalBottles
    ) {
      throw new CatalogMigrationApplyError("postflight_failed", {
        parentId: family.plan.parent.id,
        groupId: family.groupId,
        reason: "group_membership_mismatch",
      });
    }
    const groupDistillers =
      state.groupDistillerIdsByGroupId.get(group.id) ?? [];
    if (!sameValue(groupDistillers, family.groupDistillerIds)) {
      throw new CatalogMigrationApplyError("postflight_failed", {
        parentId: parent.id,
        reason: "group_distillers_mismatch",
      });
    }

    for (const { release, bottle: insertedBottle } of family.promoted) {
      const bottle = state.bottleById.get(insertedBottle.id);
      const mapping = state.mappingByReleaseId.get(release.id);
      if (!bottle || !mapping || mapping.promotedBottleId !== bottle.id) {
        throw new CatalogMigrationApplyError("postflight_failed", {
          parentId: parent.id,
          releaseId: release.id,
          reason: "promotion_mapping_mismatch",
        });
      }
      assertBottleMaterialization(parent, release, bottle, group.id);
      if (
        !sameValue(
          state.ownedRowsByBottleId.get(bottle.id) ?? emptyOwnedRows(),
          family.plan.ownedRows,
        )
      ) {
        throw new CatalogMigrationApplyError("postflight_failed", {
          parentId: parent.id,
          releaseId: release.id,
          bottleId: bottle.id,
          reason: "promoted_joins_mismatch",
        });
      }
    }
    assertCanonicalAliases(state.aliasByName, [
      ...(family.plan.sharedParentIdentity ? [] : [parent]),
      ...family.promoted.map(({ bottle }) => bottle),
    ]);
  }
}

async function loadCompletedFamilies(
  tx: AnyTransaction,
  state: MigrationState,
): Promise<AppliedFamily[]> {
  if (state.mappings.length !== state.releases.length) {
    throw new CatalogMigrationApplyError("partial_state", {
      releaseCount: state.releases.length,
      mappingCount: state.mappings.length,
    });
  }
  const promotedIds = new Set(
    state.mappings.flatMap(({ promotedBottleId }) =>
      promotedBottleId === null ? [] : [promotedBottleId],
    ),
  );
  const parentState: MigrationState = {
    ...state,
    bottles: state.bottles.filter(({ id }) => !promotedIds.has(id)),
  };
  const plans = await buildFamilyPlansForCompletedState(tx, parentState);
  const mappingByReleaseId = new Map(
    state.mappings.map((mapping) => [mapping.releaseId, mapping]),
  );
  const bottleById = new Map(
    state.bottles.map((bottle) => [bottle.id, bottle]),
  );
  const plansByGroupId = new Map<number, FamilyPlan[]>();
  for (const plan of plans) {
    if (plan.parent.groupId === null) continue;
    const groupPlans = plansByGroupId.get(plan.parent.groupId) ?? [];
    groupPlans.push(plan);
    plansByGroupId.set(plan.parent.groupId, groupPlans);
  }
  return plans.map((plan) => {
    if (plan.parent.groupId === null) {
      throw new CatalogMigrationApplyError("partial_state", {
        parentId: plan.parent.id,
        reason: "parent_group_missing",
      });
    }
    const groupPlans = plansByGroupId.get(plan.parent.groupId) ?? [plan];
    const representativeParentId = Math.min(
      ...groupPlans.map(({ parent }) => parent.id),
    );
    return {
      plan,
      groupId: plan.parent.groupId,
      representativeParentId,
      groupTotalBottles: groupPlans.reduce(
        (total, groupPlan) => total + groupPlan.releases.length + 1,
        0,
      ),
      groupDistillerIds: [
        ...new Set(
          groupPlans.flatMap(({ ownedRows }) => ownedRows.distillerIds),
        ),
      ].sort((left, right) => left - right),
      promoted: plan.releases.map((release) => {
        const mapping = mappingByReleaseId.get(release.id);
        const bottle =
          mapping?.promotedBottleId === null ||
          mapping?.promotedBottleId === undefined
            ? undefined
            : bottleById.get(mapping.promotedBottleId);
        if (!mapping || !bottle || bottle.groupId !== plan.parent.groupId) {
          throw new CatalogMigrationApplyError("partial_state", {
            parentId: plan.parent.id,
            releaseId: release.id,
            reason: "promotion_missing",
          });
        }
        return { release, bottle };
      }),
    };
  });
}

async function buildFamilyPlansForCompletedState(
  tx: AnyTransaction,
  state: MigrationState,
): Promise<FamilyPlan[]> {
  const releasesByParentId = new Map<number, BottleRelease[]>();
  for (const release of state.releases) {
    const familyReleases = releasesByParentId.get(release.bottleId) ?? [];
    familyReleases.push(release);
    releasesByParentId.set(release.bottleId, familyReleases);
  }
  const parentIds = new Set(state.bottles.map(({ id }) => id));
  const ownedRowsByBottleId = await loadBottleOwnedRowsByBottleId(tx);
  const parentCountByGroupId = new Map<number, number>();
  for (const parent of state.bottles) {
    if (parent.groupId !== null) {
      parentCountByGroupId.set(
        parent.groupId,
        (parentCountByGroupId.get(parent.groupId) ?? 0) + 1,
      );
    }
  }
  const plans: FamilyPlan[] = [];
  for (const parent of state.bottles) {
    plans.push({
      parent,
      releases: releasesByParentId.get(parent.id) ?? [],
      ownedRows: ownedRowsByBottleId.get(parent.id) ?? emptyOwnedRows(),
      groupKey: claimKey(parent.fullName),
      sharedParentIdentity:
        parent.groupId !== null &&
        (parentCountByGroupId.get(parent.groupId) ?? 0) > 1,
    });
  }
  if (state.releases.some((release) => !parentIds.has(release.bottleId))) {
    throw new CatalogMigrationApplyError("partial_state", {
      reason: "release_parent_missing",
    });
  }
  return plans;
}

async function classifyState(
  tx: AnyTransaction,
  state: MigrationState,
): Promise<
  | { status: "pending" }
  | { status: "already_complete"; families: AppliedFamily[] }
> {
  if (
    !state.bottles.length &&
    !state.releases.length &&
    !state.mappings.length
  ) {
    return { status: "already_complete", families: [] };
  }
  if (!state.mappings.length) {
    const assignedParents = state.bottles.filter(
      ({ groupId }) => groupId !== null,
    );
    if (!assignedParents.length) return { status: "pending" };
    if (
      !state.releases.length &&
      assignedParents.length === state.bottles.length
    ) {
      const families = await loadCompletedFamilies(tx, state);
      return { status: "already_complete", families };
    }
    throw new CatalogMigrationApplyError("partial_state", {
      assignedParentIds: assignedParents.map(({ id }) => id),
      mappingCount: 0,
      releaseCount: state.releases.length,
    });
  }
  return {
    status: "already_complete",
    families: await loadCompletedFamilies(tx, state),
  };
}

function countsFor(
  plans: FamilyPlan[],
  aliases: { changed: number; reused: number },
  consumers: CatalogMigrationConsumerResult,
  stats: CatalogMigrationStatsResult,
): CatalogMigrationApplyResult["counts"] {
  const releases = plans.reduce(
    (count, family) => count + family.releases.length,
    0,
  );
  return {
    parents: plans.length,
    groups: new Set(plans.map(({ groupKey }) => groupKey)).size,
    parentBottlesAssigned: plans.length,
    releases,
    promotedBottles: releases,
    promotionMappings: releases,
    canonicalAliasesChanged: aliases.changed,
    canonicalAliasesReused: aliases.reused,
    groupDistillers: [
      ...plans
        .reduce((byGroup, family) => {
          const ids = byGroup.get(family.groupKey) ?? new Set<number>();
          for (const id of family.ownedRows.distillerIds) ids.add(id);
          byGroup.set(family.groupKey, ids);
          return byGroup;
        }, new Map<string, Set<number>>())
        .values(),
    ].reduce((count, ids) => count + ids.size, 0),
    bottleDistillers: plans.reduce(
      (count, family) =>
        count + family.ownedRows.distillerIds.length * family.releases.length,
      0,
    ),
    bottleTags: plans.reduce(
      (count, family) =>
        count + family.ownedRows.tags.length * family.releases.length,
      0,
    ),
    bottleFlavorProfiles: plans.reduce(
      (count, family) =>
        count + family.ownedRows.flavorProfiles.length * family.releases.length,
      0,
    ),
    bottleStatsRecomputed: stats.bottlesRecomputed,
    groupStatsRecomputed: stats.groupsRecomputed,
    consumers: CatalogMigrationConsumerResultSchema.parse(consumers),
  };
}

function assertPostflightAudit(
  audit: CatalogMigrationApplyResult["postflightAudit"],
  {
    parentCount,
    releaseCount,
  }: {
    parentCount: number;
    releaseCount: number;
  },
): void {
  if (
    audit.blockingIssueCount !== 0 ||
    audit.collisions.count !== 0 ||
    audit.legacyCatalog.totalParents !== parentCount ||
    audit.legacyCatalog.totalReleases !== releaseCount ||
    audit.promotionMappings.totalLegacyReleases !== releaseCount ||
    audit.promotionMappings.totalMappings !== releaseCount ||
    audit.promotionMappings.validMappings !== releaseCount ||
    audit.promotionMappings.mappedReleases !== releaseCount ||
    audit.promotionMappings.unmappedReleases !== 0 ||
    audit.promotionMappings.invalidMappings !== 0 ||
    audit.references.some(({ invalidRows }) => invalidRows !== 0)
  ) {
    throw new CatalogMigrationApplyError("postflight_failed", {
      parentCount,
      releaseCount,
      audit,
    });
  }
}

/**
 * Applies the approved catalog migration exactly once. A complete second call
 * validates the committed graph and returns `already_complete` with zero writes.
 */
export async function applyCatalogMigration(
  input: unknown,
  database: AnyConnection = db,
  migrationsFolder?: string,
): Promise<CatalogMigrationApplyResult> {
  const parsed = CatalogMigrationApplyInputSchema.parse(input);
  if (
    Date.parse(parsed.approval.approvedAt) <=
    Date.parse(parsed.candidate.audit.generatedAt)
  ) {
    throw new CatalogMigrationApplyError("approval_invalid", {
      approvedAt: parsed.approval.approvedAt,
      auditGeneratedAt: parsed.candidate.audit.generatedAt,
    });
  }
  await assertWritablePrimaryPreflight(database);

  const startedAt = new Date();
  const transactionResult = await database.transaction(async (tx) => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
    // Preserve the authoritative snapshot: no SELECT may precede these locks.
    await lockMigrationTables(tx);
    const databaseEvidence = await loadCatalogMigrationDatabaseEvidence(tx);
    const revision = await loadCatalogMigrationRevisionEvidenceInTransaction(
      parsed.candidate.revision.gitRevision,
      tx,
      migrationsFolder,
      databaseEvidence,
    );
    assertApprovedPreflight(parsed.candidate, revision);

    const state = await loadMigrationState(tx);
    const classification = await classifyState(tx, state);
    if (classification.status === "already_complete") {
      const completedStatsFamilies = statsFamilies(classification.families);
      await assertAppliedFamilies(tx, classification.families);
      await assertLegacyConsumersPromotedInTransaction(tx);
      await assertCatalogMigrationStatsInTransaction(
        tx,
        completedStatsFamilies,
      );
      const postflightAudit = await collectCatalogMigrationAudit(
        tx,
        revision.databaseEvidence,
      );
      assertPostflightAudit(postflightAudit, {
        parentCount: classification.families.length,
        releaseCount: state.releases.length,
      });
      return {
        status: "already_complete" as const,
        revision,
        counts: {
          ...ZERO_CORE_COUNTS,
          consumers: EMPTY_CONSUMER_RESULT,
        },
        postflightAudit,
      };
    }

    await assertAuditUnchanged(tx, parsed.candidate, revision);
    const plans = await buildFamilyPlans(tx, state);
    const consumerPreflight = await preflightLegacyConsumersInTransaction(tx);
    const plansByGroupKey = new Map<string, FamilyPlan[]>();
    for (const plan of plans) {
      const groupPlans = plansByGroupKey.get(plan.groupKey) ?? [];
      groupPlans.push(plan);
      plansByGroupKey.set(plan.groupKey, groupPlans);
    }
    const applied: AppliedFamily[] = [];
    for (const groupPlans of plansByGroupKey.values()) {
      applied.push(...(await insertGroup(tx, groupPlans)));
    }

    const consumers = await repointLegacyConsumersInTransaction(
      tx,
      consumerPreflight,
    );
    const aliases = await reserveCanonicalAliases(tx, applied);
    const appliedStatsFamilies = statsFamilies(applied);
    const stats = await recomputeCatalogMigrationStatsInTransaction(
      tx,
      appliedStatsFamilies,
    );
    await assertAppliedFamilies(tx, applied);
    await assertLegacyConsumersPromotedInTransaction(tx);

    const finalState = await loadMigrationState(tx);
    if (
      finalState.bottles.length !==
        state.bottles.length + state.releases.length ||
      finalState.mappings.length !== state.releases.length
    ) {
      throw new CatalogMigrationApplyError("postflight_failed", {
        initialBottleCount: state.bottles.length,
        finalBottleCount: finalState.bottles.length,
        releaseCount: state.releases.length,
        mappingCount: finalState.mappings.length,
      });
    }
    const postflightAudit = await collectCatalogMigrationAudit(
      tx,
      revision.databaseEvidence,
    );
    assertPostflightAudit(postflightAudit, {
      parentCount: plans.length,
      releaseCount: state.releases.length,
    });

    return {
      status: "applied" as const,
      revision,
      counts: countsFor(plans, aliases, consumers, stats),
      postflightAudit,
    };
  });

  return CatalogMigrationApplyResultSchema.parse({
    schemaVersion: CATALOG_MIGRATION_APPLY_SCHEMA_VERSION,
    status: transactionResult.status,
    approvedAuditGeneratedAt: parsed.candidate.audit.generatedAt,
    revision: transactionResult.revision,
    approval: parsed.approval,
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    counts: transactionResult.counts,
    postflightAudit: transactionResult.postflightAudit,
  });
}
