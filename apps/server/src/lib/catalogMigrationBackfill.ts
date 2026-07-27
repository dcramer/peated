/**
 * Builds the additive BottleGroup/Bottle/CatalogTarget graph for legacy
 * parents. Each parent family commits independently so keyset batches can
 * resume safely without exposing a partially promoted family.
 */
import { and, asc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import {
  db,
  type AnyConnection,
  type AnyDatabase,
  type AnyTransaction,
} from "../db";
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
  catalogTargets,
  type Bottle,
  type BottleGroup,
  type BottleRelease,
} from "../db/schema";
import {
  CatalogMigrationBottleAliasConflictError,
  reserveLegacyPromotionCanonicalAliasInTransaction,
} from "./catalogMigrationBottleAliases";

export type CatalogMigrationBackfillErrorCode =
  | "invalid_limit"
  | "parent_not_found"
  | "ambiguous_parent_identity"
  | "name_collision"
  | "alias_collision"
  | "partial_group_graph"
  | "partial_promotion"
  | "promotion_mismatch";

export class CatalogMigrationBackfillError extends Error {
  constructor(
    readonly code: CatalogMigrationBackfillErrorCode,
    readonly parentId: number,
    readonly releaseId: number | null,
    readonly details: Record<string, unknown> = {},
  ) {
    super(
      `Catalog migration backfill ${code} for parent ${parentId}${releaseId ? ` release ${releaseId}` : ""}.`,
    );
    this.name = "CatalogMigrationBackfillError";
  }
}

export type CatalogMigrationParentResult = {
  parentId: number;
  groupId: number;
  genericTargetId: number;
  releaseCount: number;
  retainedBottleId: number | null;
  representativeBottleId: number;
  promoted: Array<{
    releaseId: number;
    bottleId: number;
    targetId: number;
    outcome: "created" | "reused";
  }>;
  outcome: "created" | "reused";
};

export type LegacyCatalogParentCandidateOptions = {
  afterParentId?: number;
  limit?: number;
};

const PARENT_EXACT_FIELDS = [
  "edition",
  "vintageYear",
  "releaseYear",
  "abv",
  "singleCask",
  "caskStrength",
  "caskSize",
  "caskType",
  "caskFill",
] as const satisfies ReadonlyArray<keyof Bottle>;

const STABLE_BOTTLE_FIELDS = [
  "brandId",
  "bottlerId",
  "category",
  "seriesId",
  "flavorProfile",
] as const satisfies ReadonlyArray<keyof Bottle>;

const GROUP_SCALAR_FIELDS = [
  "name",
  "fullName",
  "statedAge",
  ...STABLE_BOTTLE_FIELDS,
  "description",
  "descriptionSrc",
  "imageUrl",
  "createdAt",
  "updatedAt",
  "createdByActorId",
] as const satisfies ReadonlyArray<keyof BottleGroup & keyof Bottle>;

const PROMOTED_BOTTLE_FIELDS = [
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
  "avgRating",
  "totalTastings",
  "searchVector",
  "createdAt",
  "updatedAt",
  "createdByActorId",
] as const satisfies ReadonlyArray<keyof Bottle>;

type PromotedBottleMaterialization = Pick<
  Bottle,
  (typeof PROMOTED_BOTTLE_FIELDS)[number]
>;

function sameValue(left: unknown, right: unknown): boolean {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }
  return left === right;
}

function sameMaterializedValue(left: unknown, right: unknown): boolean {
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
  return sameValue(left, right);
}

function sameNumberList(left: number[], right: number[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function sameStringList(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function contentValue<T>(
  releaseValue: T | null,
  parentValue: T | null,
): T | null {
  return releaseValue ?? parentValue;
}

function imageValue(release: BottleRelease, parent: Bottle): string | null {
  return release.imageUrl?.trim() ? release.imageUrl : parent.imageUrl;
}

function suggestedTagsValue(release: BottleRelease, parent: Bottle): string[] {
  return release.suggestedTags.length
    ? release.suggestedTags
    : parent.suggestedTags;
}

async function loadParentFamily(tx: AnyTransaction, parentId: number) {
  const [parent] = await tx
    .select()
    .from(bottles)
    .where(eq(bottles.id, parentId))
    .for("update");
  if (!parent) {
    throw new CatalogMigrationBackfillError("parent_not_found", parentId, null);
  }

  const releases = await tx
    .select()
    .from(bottleReleases)
    .where(eq(bottleReleases.bottleId, parentId))
    .orderBy(asc(bottleReleases.id))
    .for("update");
  const releaseIds = releases.map(({ id }) => id);
  const mappings = releaseIds.length
    ? await tx
        .select()
        .from(bottleReleasePromotions)
        .where(inArray(bottleReleasePromotions.releaseId, releaseIds))
        .orderBy(asc(bottleReleasePromotions.releaseId))
        .for("update")
    : [];

  return { parent, releases, mappings };
}

async function loadParentOwnedRows(tx: AnyTransaction, parentId: number) {
  const [distillers, tags, flavorProfiles] = await Promise.all([
    tx
      .select({ distillerId: bottlesToDistillers.distillerId })
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, parentId))
      .orderBy(asc(bottlesToDistillers.distillerId)),
    tx
      .select({ tag: bottleTags.tag, count: bottleTags.count })
      .from(bottleTags)
      .where(eq(bottleTags.bottleId, parentId))
      .orderBy(asc(bottleTags.tag)),
    tx
      .select({
        flavorProfile: bottleFlavorProfiles.flavorProfile,
        count: bottleFlavorProfiles.count,
      })
      .from(bottleFlavorProfiles)
      .where(eq(bottleFlavorProfiles.bottleId, parentId))
      .orderBy(asc(bottleFlavorProfiles.flavorProfile)),
  ]);
  return { distillers, tags, flavorProfiles };
}

function assertGroupMatchesParent(group: BottleGroup, parent: Bottle) {
  const mismatches = GROUP_SCALAR_FIELDS.filter(
    (field) => !sameValue(group[field], parent[field]),
  ).map(String);
  if (
    JSON.stringify(group.tastingNotes) !== JSON.stringify(parent.tastingNotes)
  ) {
    mismatches.push("tastingNotes");
  }
  if (!sameStringList(group.suggestedTags, parent.suggestedTags)) {
    mismatches.push("suggestedTags");
  }
  if (mismatches.length) {
    throw new CatalogMigrationBackfillError(
      "partial_group_graph",
      parent.id,
      null,
      { groupId: group.id, mismatches },
    );
  }
}

async function ensureParentGroup(
  tx: AnyTransaction,
  parent: Bottle,
  distillerIds: number[],
): Promise<{ group: BottleGroup; genericTargetId: number; created: boolean }> {
  let group: BottleGroup;
  let created = false;
  if (parent.groupId) {
    const [existing] = await tx
      .select()
      .from(bottleGroups)
      .where(eq(bottleGroups.id, parent.groupId))
      .for("update");
    if (!existing) {
      throw new CatalogMigrationBackfillError(
        "partial_group_graph",
        parent.id,
        null,
        { groupId: parent.groupId, missing: "group" },
      );
    }
    assertGroupMatchesParent(existing, parent);
    group = existing;
  } else {
    const [inserted] = await tx
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
    if (!inserted) {
      throw new CatalogMigrationBackfillError(
        "partial_group_graph",
        parent.id,
        null,
        { missing: "created_group" },
      );
    }
    group = inserted;
    created = true;
    // This migration-only groupId is staging membership; it does not make the
    // parent a promoted exact Bottle. Exact identity requires an exact target.
    await tx
      .update(bottles)
      .set({ groupId: group.id })
      .where(and(eq(bottles.id, parent.id), isNull(bottles.groupId)));
  }

  const existingDistillers = await tx
    .select({ distillerId: bottleGroupDistillers.distillerId })
    .from(bottleGroupDistillers)
    .where(eq(bottleGroupDistillers.groupId, group.id))
    .orderBy(asc(bottleGroupDistillers.distillerId));
  if (created && !existingDistillers.length && distillerIds.length) {
    await tx
      .insert(bottleGroupDistillers)
      .values(
        distillerIds.map((distillerId) => ({ groupId: group.id, distillerId })),
      );
  } else if (
    !sameNumberList(
      existingDistillers.map(({ distillerId }) => distillerId),
      distillerIds,
    )
  ) {
    throw new CatalogMigrationBackfillError(
      "partial_group_graph",
      parent.id,
      null,
      { groupId: group.id, mismatch: "distillers" },
    );
  }

  const genericTargets = await tx
    .select()
    .from(catalogTargets)
    .where(
      and(
        eq(catalogTargets.groupId, group.id),
        isNull(catalogTargets.bottleId),
      ),
    )
    .orderBy(asc(catalogTargets.id))
    .for("update");
  if (genericTargets.length > 1) {
    throw new CatalogMigrationBackfillError(
      "partial_group_graph",
      parent.id,
      null,
      { groupId: group.id, duplicate: "generic_target" },
    );
  }
  let genericTarget = genericTargets[0];
  if (!genericTarget) {
    if (!created) {
      throw new CatalogMigrationBackfillError(
        "partial_group_graph",
        parent.id,
        null,
        { groupId: group.id, missing: "generic_target" },
      );
    }
    [genericTarget] = await tx
      .insert(catalogTargets)
      .values({ groupId: group.id })
      .returning();
  }
  if (!genericTarget) {
    throw new CatalogMigrationBackfillError(
      "partial_group_graph",
      parent.id,
      null,
      { groupId: group.id, missing: "created_generic_target" },
    );
  }
  return { group, genericTargetId: genericTarget.id, created };
}

async function preflightReleaseFamily(
  tx: AnyTransaction,
  parent: Bottle,
  releases: BottleRelease[],
  mappings: Array<typeof bottleReleasePromotions.$inferSelect>,
) {
  const ambiguousFields = PARENT_EXACT_FIELDS.filter(
    (field) => parent[field] !== null,
  );
  if (ambiguousFields.length) {
    throw new CatalogMigrationBackfillError(
      "ambiguous_parent_identity",
      parent.id,
      null,
      { fields: ambiguousFields },
    );
  }
  const releasesById = new Map(
    releases.map((release) => [release.id, release]),
  );
  const releasesByName = new Map<string, BottleRelease>();
  const completedBottleByReleaseId = new Map(
    mappings.flatMap((mapping) =>
      mapping.status === "promoted" && mapping.promotedBottleId
        ? [[mapping.releaseId, mapping.promotedBottleId] as const]
        : [],
    ),
  );
  const completedBottleIds = [...completedBottleByReleaseId.values()];
  const completedExactTargets = completedBottleIds.length
    ? await tx
        .select({ id: catalogTargets.id, bottleId: catalogTargets.bottleId })
        .from(catalogTargets)
        .where(inArray(catalogTargets.bottleId, completedBottleIds))
    : [];
  const completedExactTargetByBottleId = new Map(
    completedExactTargets.flatMap((target) =>
      target.bottleId ? [[target.bottleId, target.id] as const] : [],
    ),
  );
  for (const release of releases) {
    const key = release.fullName.toLowerCase();
    if (releasesByName.has(key)) {
      throw new CatalogMigrationBackfillError(
        "name_collision",
        parent.id,
        release.id,
        { fullName: release.fullName, kind: "release_family" },
      );
    }
    releasesByName.set(key, release);
  }

  const releaseIds = releases.map(({ id }) => id);
  const ownedAliases = await tx
    .select({
      name: bottleAliases.name,
      bottleId: bottleAliases.bottleId,
      releaseId: bottleAliases.releaseId,
      targetId: bottleAliases.targetId,
      ignored: bottleAliases.ignored,
    })
    .from(bottleAliases)
    .where(
      or(
        eq(bottleAliases.bottleId, parent.id),
        inArray(bottleAliases.releaseId, releaseIds),
      ),
    )
    .for("update");
  const ownedAliasTargetIds = ownedAliases.flatMap(({ targetId }) =>
    targetId === null ? [] : [targetId],
  );
  const ownedAliasTargets = ownedAliasTargetIds.length
    ? await tx
        .select()
        .from(catalogTargets)
        .where(inArray(catalogTargets.id, ownedAliasTargetIds))
    : [];
  const ownedAliasTargetById = new Map(
    ownedAliasTargets.map((target) => [target.id, target]),
  );
  const identityNames = [
    ...new Set([
      ...releasesByName.keys(),
      ...ownedAliases.map(({ name }) => name.toLowerCase()),
    ]),
  ];
  const canonicalBottles = identityNames.length
    ? await tx
        .select({ id: bottles.id, fullName: bottles.fullName })
        .from(bottles)
        .where(inArray(sql<string>`LOWER(${bottles.fullName})`, identityNames))
    : [];
  const canonicalBottlesByName = new Map<
    string,
    Array<(typeof canonicalBottles)[number]>
  >();
  for (const bottle of canonicalBottles) {
    const key = bottle.fullName.toLowerCase();
    canonicalBottlesByName.set(key, [
      ...(canonicalBottlesByName.get(key) ?? []),
      bottle,
    ]);
  }
  const canonicalAliases = await tx
    .select({
      name: bottleAliases.name,
      bottleId: bottleAliases.bottleId,
      releaseId: bottleAliases.releaseId,
      targetId: bottleAliases.targetId,
      ignored: bottleAliases.ignored,
    })
    .from(bottleAliases)
    .where(
      inArray(sql<string>`LOWER(${bottleAliases.name})`, [
        ...releasesByName.keys(),
      ]),
    )
    .for("update");
  const canonicalAliasByName = new Map(
    canonicalAliases.map((alias) => [alias.name.toLowerCase(), alias]),
  );

  // Only the same legacy release or its promoted exact identity can exempt a
  // canonical-name collision; unrelated and ignored aliases remain conflicts.
  const aliasMatchesRelease = (
    alias: (typeof canonicalAliases)[number],
    release: BottleRelease,
  ) => {
    if (alias.ignored === true) return false;
    const promotedBottleId = completedBottleByReleaseId.get(release.id);
    const exactTargetId = promotedBottleId
      ? completedExactTargetByBottleId.get(promotedBottleId)
      : undefined;
    const targetMatches =
      alias.targetId === null || alias.targetId === exactTargetId;
    const legacyOwnership =
      alias.releaseId === release.id &&
      (alias.bottleId === parent.id || alias.bottleId === promotedBottleId);
    const promotedOwnership =
      promotedBottleId !== undefined &&
      (alias.bottleId === promotedBottleId || alias.targetId === exactTargetId);
    return targetMatches && (legacyOwnership || promotedOwnership);
  };

  for (const release of releases) {
    const key = release.fullName.toLowerCase();
    const canonicalBottle = canonicalBottlesByName
      .get(key)
      ?.find(({ id }) => id !== completedBottleByReleaseId.get(release.id));
    if (canonicalBottle) {
      throw new CatalogMigrationBackfillError(
        "name_collision",
        parent.id,
        release.id,
        { fullName: release.fullName, bottleId: canonicalBottle.id },
      );
    }
    const canonicalAlias = canonicalAliasByName.get(key);
    if (canonicalAlias && !aliasMatchesRelease(canonicalAlias, release)) {
      throw new CatalogMigrationBackfillError(
        "alias_collision",
        parent.id,
        release.id,
        {
          fullName: release.fullName,
          aliasName: canonicalAlias.name,
          aliasBottleId: canonicalAlias.bottleId,
          aliasReleaseId: canonicalAlias.releaseId,
          aliasTargetId: canonicalAlias.targetId,
          aliasIgnored: canonicalAlias.ignored,
        },
      );
    }
  }

  for (const alias of ownedAliases) {
    const key = alias.name.toLowerCase();
    const aliasTarget =
      alias.targetId === null
        ? undefined
        : ownedAliasTargetById.get(alias.targetId);
    const plannedRelease = releasesByName.get(key);
    if (plannedRelease && !aliasMatchesRelease(alias, plannedRelease)) {
      throw new CatalogMigrationBackfillError(
        "alias_collision",
        parent.id,
        alias.releaseId,
        {
          aliasName: alias.name,
          aliasBottleId: alias.bottleId,
          aliasReleaseId: alias.releaseId,
          aliasTargetId: alias.targetId,
          aliasIgnored: alias.ignored,
          conflictingReleaseId: plannedRelease.id,
          conflictingFullName: plannedRelease.fullName,
        },
      );
    }
    const matchingCanonicalBottles = canonicalBottlesByName.get(key) ?? [];
    if (!matchingCanonicalBottles.length) continue;
    const ownedRelease = alias.releaseId
      ? releasesById.get(alias.releaseId)
      : undefined;
    const conflictingBottle = matchingCanonicalBottles.find(
      (canonicalBottle) =>
        !(
          alias.ignored !== true &&
          ((ownedRelease &&
            canonicalBottle.id ===
              completedBottleByReleaseId.get(ownedRelease.id) &&
            aliasMatchesRelease(alias, ownedRelease)) ||
            (alias.releaseId === null &&
              alias.bottleId === canonicalBottle.id &&
              (alias.targetId === null ||
                (parent.groupId !== null &&
                  aliasTarget?.groupId === parent.groupId &&
                  aliasTarget.bottleId === null))))
        ),
    );
    if (conflictingBottle) {
      throw new CatalogMigrationBackfillError(
        "alias_collision",
        parent.id,
        alias.releaseId,
        {
          aliasName: alias.name,
          aliasBottleId: alias.bottleId,
          aliasReleaseId: alias.releaseId,
          aliasTargetId: alias.targetId,
          aliasIgnored: alias.ignored,
          conflictingBottleId: conflictingBottle.id,
          conflictingFullName: conflictingBottle.fullName,
        },
      );
    }
  }
}

function buildPromotedBottleMaterialization(
  parent: Bottle,
  release: BottleRelease,
  groupId: number,
): PromotedBottleMaterialization {
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
    description: contentValue(release.description, parent.description),
    descriptionSrc:
      release.description !== null
        ? release.descriptionSrc
        : parent.descriptionSrc,
    imageUrl: imageValue(release, parent),
    tastingNotes: contentValue(release.tastingNotes, parent.tastingNotes),
    suggestedTags: suggestedTagsValue(release, parent),
    avgRating: release.avgRating,
    totalTastings: release.totalTastings,
    searchVector: release.searchVector,
    createdAt: release.createdAt,
    updatedAt: release.updatedAt,
    createdByActorId: release.createdByActorId,
  };
}

function assertPromotedBottleFields(
  parent: Bottle,
  release: BottleRelease,
  promoted: Bottle,
  groupId: number,
) {
  const planned = buildPromotedBottleMaterialization(parent, release, groupId);
  const mismatches = PROMOTED_BOTTLE_FIELDS.filter(
    (field) => !sameMaterializedValue(promoted[field], planned[field]),
  );
  if (mismatches.length) {
    throw new CatalogMigrationBackfillError(
      "promotion_mismatch",
      parent.id,
      release.id,
      { bottleId: promoted.id, mismatches },
    );
  }
}

async function assertPromotedJoins(
  tx: AnyTransaction,
  parentId: number,
  releaseId: number,
  bottleId: number,
  parentRows: Awaited<ReturnType<typeof loadParentOwnedRows>>,
) {
  const rows = await loadParentOwnedRows(tx, bottleId);
  if (
    !sameNumberList(
      rows.distillers.map(({ distillerId }) => distillerId),
      parentRows.distillers.map(({ distillerId }) => distillerId),
    ) ||
    JSON.stringify(rows.tags) !== JSON.stringify(parentRows.tags) ||
    JSON.stringify(rows.flavorProfiles) !==
      JSON.stringify(parentRows.flavorProfiles)
  ) {
    throw new CatalogMigrationBackfillError(
      "promotion_mismatch",
      parentId,
      releaseId,
      { bottleId, mismatch: "joins" },
    );
  }
}

async function reservePromotionCanonicalAlias(
  tx: AnyTransaction,
  parent: Bottle,
  release: BottleRelease,
  bottleId: number,
  targetId: number,
  validateOnly: boolean,
) {
  try {
    const reservation = await reserveLegacyPromotionCanonicalAliasInTransaction(
      tx,
      {
        name: release.fullName,
        promotedBottleId: bottleId,
        targetId,
        legacyBottleId: parent.id,
        legacyReleaseId: release.id,
        assignedByActorId: release.createdByActorId,
      },
    );
    if (validateOnly && reservation.changed) {
      throw new CatalogMigrationBackfillError(
        "alias_collision",
        parent.id,
        release.id,
        {
          fullName: release.fullName,
          bottleId,
          targetId,
          kind: "canonical_alias_missing_or_drifted",
        },
      );
    }
  } catch (error) {
    if (!(error instanceof CatalogMigrationBottleAliasConflictError)) {
      throw error;
    }
    throw new CatalogMigrationBackfillError(
      "alias_collision",
      parent.id,
      release.id,
      {
        fullName: release.fullName,
        bottleId,
        targetId,
        conflictCode: error.code,
        aliasName: error.alias.name,
        aliasBottleId: error.alias.bottleId,
        aliasReleaseId: error.alias.releaseId,
        aliasTargetId: error.alias.targetId,
        aliasIgnored: error.alias.ignored,
        conflictingBottleId: error.conflictingBottleId,
      },
    );
  }
}

async function promoteRelease(
  tx: AnyTransaction,
  parent: Bottle,
  release: BottleRelease,
  groupId: number,
  parentRows: Awaited<ReturnType<typeof loadParentOwnedRows>>,
  existingMapping: typeof bottleReleasePromotions.$inferSelect | undefined,
) {
  const materialization = buildPromotedBottleMaterialization(
    parent,
    release,
    groupId,
  );
  if (existingMapping) {
    if (
      existingMapping.status !== "promoted" ||
      !existingMapping.promotedBottleId ||
      !existingMapping.completedAt ||
      existingMapping.error
    ) {
      throw new CatalogMigrationBackfillError(
        "partial_promotion",
        parent.id,
        release.id,
        { status: existingMapping.status },
      );
    }
    const [promoted] = await tx
      .select()
      .from(bottles)
      .where(eq(bottles.id, existingMapping.promotedBottleId))
      .for("update");
    if (!promoted) {
      throw new CatalogMigrationBackfillError(
        "promotion_mismatch",
        parent.id,
        release.id,
        { missing: "bottle", bottleId: existingMapping.promotedBottleId },
      );
    }
    assertPromotedBottleFields(parent, release, promoted, groupId);
    const targets = await tx
      .select()
      .from(catalogTargets)
      .where(eq(catalogTargets.bottleId, promoted.id))
      .for("update");
    if (
      targets.length !== 1 ||
      targets[0]?.groupId !== groupId ||
      targets[0].bottleId !== promoted.id
    ) {
      throw new CatalogMigrationBackfillError(
        "promotion_mismatch",
        parent.id,
        release.id,
        { bottleId: promoted.id, mismatch: "exact_target" },
      );
    }
    await reservePromotionCanonicalAlias(
      tx,
      parent,
      release,
      promoted.id,
      targets[0].id,
      true,
    );
    await assertPromotedJoins(
      tx,
      parent.id,
      release.id,
      promoted.id,
      parentRows,
    );
    return {
      bottleId: promoted.id,
      targetId: targets[0].id,
      outcome: "reused" as const,
    };
  }

  await tx.insert(bottleReleasePromotions).values({
    releaseId: release.id,
    status: "pending",
    startedAt: new Date(),
    createdByActorId: release.createdByActorId,
    auditMetadata: { parentId: parent.id, groupId, releaseId: release.id },
  });
  const [promoted] = await tx
    .insert(bottles)
    .values(materialization)
    .returning();
  if (!promoted) {
    throw new CatalogMigrationBackfillError(
      "partial_promotion",
      parent.id,
      release.id,
      { missing: "created_bottle" },
    );
  }
  if (parentRows.distillers.length) {
    await tx.insert(bottlesToDistillers).values(
      parentRows.distillers.map(({ distillerId }) => ({
        bottleId: promoted.id,
        distillerId,
      })),
    );
  }
  if (parentRows.tags.length) {
    await tx
      .insert(bottleTags)
      .values(
        parentRows.tags.map((tag) => ({ bottleId: promoted.id, ...tag })),
      );
  }
  if (parentRows.flavorProfiles.length) {
    await tx.insert(bottleFlavorProfiles).values(
      parentRows.flavorProfiles.map((profile) => ({
        bottleId: promoted.id,
        ...profile,
      })),
    );
  }
  const [target] = await tx
    .insert(catalogTargets)
    .values({ groupId, bottleId: promoted.id })
    .returning();
  if (!target) {
    throw new CatalogMigrationBackfillError(
      "partial_promotion",
      parent.id,
      release.id,
      { bottleId: promoted.id, missing: "exact_target" },
    );
  }
  await reservePromotionCanonicalAlias(
    tx,
    parent,
    release,
    promoted.id,
    target.id,
    false,
  );
  const completedAt = new Date();
  await tx
    .update(bottleReleasePromotions)
    .set({
      status: "promoted",
      promotedBottleId: promoted.id,
      completedAt,
      updatedAt: completedAt,
      error: null,
      auditMetadata: {
        parentId: parent.id,
        groupId,
        releaseId: release.id,
        promotedBottleId: promoted.id,
        targetId: target.id,
      },
    })
    .where(eq(bottleReleasePromotions.releaseId, release.id));
  return {
    bottleId: promoted.id,
    targetId: target.id,
    outcome: "created" as const,
  };
}

async function retainSingletonParent(
  tx: AnyTransaction,
  parent: Bottle,
  group: BottleGroup,
  groupCreated: boolean,
) {
  const targets = await tx
    .select()
    .from(catalogTargets)
    .where(eq(catalogTargets.bottleId, parent.id))
    .for("update");
  if (targets.length > 1 || (targets[0] && targets[0].groupId !== group.id)) {
    throw new CatalogMigrationBackfillError(
      "partial_group_graph",
      parent.id,
      null,
      { groupId: group.id, mismatch: "exact_target" },
    );
  }
  let exactTarget = targets[0];
  if (!exactTarget) {
    if (!groupCreated) {
      throw new CatalogMigrationBackfillError(
        "partial_group_graph",
        parent.id,
        null,
        { groupId: group.id, missing: "exact_target" },
      );
    }
    [exactTarget] = await tx
      .insert(catalogTargets)
      .values({ groupId: group.id, bottleId: parent.id })
      .returning();
  }
  if (!exactTarget) {
    throw new CatalogMigrationBackfillError(
      "partial_group_graph",
      parent.id,
      null,
      { groupId: group.id, missing: "created_exact_target" },
    );
  }
  if (group.representativeBottleId === null && group.totalBottles === 0) {
    await tx
      .update(bottleGroups)
      .set({ representativeBottleId: parent.id, totalBottles: 1 })
      .where(eq(bottleGroups.id, group.id));
  } else if (
    group.representativeBottleId !== parent.id ||
    group.totalBottles !== 1
  ) {
    throw new CatalogMigrationBackfillError(
      "partial_group_graph",
      parent.id,
      null,
      { groupId: group.id, mismatch: "singleton_presentation" },
    );
  }
  return exactTarget.id;
}

/** Promotes or validates one complete legacy parent family atomically. */
export async function backfillLegacyCatalogParent(
  parentId: number,
  database: AnyConnection = db,
): Promise<CatalogMigrationParentResult> {
  return await database.transaction(async (tx) => {
    const { parent, releases, mappings } = await loadParentFamily(tx, parentId);
    const parentRows = await loadParentOwnedRows(tx, parent.id);
    // Existing release mappings are all-or-none: a partial family is audit
    // evidence, not state this rerunnable migration may heal.
    if (
      releases.length &&
      ((parent.groupId === null && mappings.length > 0) ||
        (parent.groupId !== null && mappings.length !== releases.length))
    ) {
      throw new CatalogMigrationBackfillError(
        "partial_promotion",
        parent.id,
        null,
        {
          groupId: parent.groupId,
          releaseCount: releases.length,
          mappingCount: mappings.length,
        },
      );
    }
    if (releases.length) {
      await preflightReleaseFamily(tx, parent, releases, mappings);
    }
    const groupResult = await ensureParentGroup(
      tx,
      parent,
      parentRows.distillers.map(({ distillerId }) => distillerId),
    );

    if (!releases.length) {
      const targetId = await retainSingletonParent(
        tx,
        { ...parent, groupId: groupResult.group.id },
        groupResult.group,
        groupResult.created,
      );
      return {
        parentId: parent.id,
        groupId: groupResult.group.id,
        genericTargetId: groupResult.genericTargetId,
        releaseCount: 0,
        retainedBottleId: parent.id,
        representativeBottleId: parent.id,
        promoted: [],
        outcome: groupResult.created ? "created" : "reused",
      };
    }

    const parentExactTargets = await tx
      .select({ id: catalogTargets.id })
      .from(catalogTargets)
      .where(eq(catalogTargets.bottleId, parent.id))
      .for("update");
    if (parentExactTargets.length) {
      throw new CatalogMigrationBackfillError(
        "partial_group_graph",
        parent.id,
        null,
        { groupId: groupResult.group.id, unexpected: "parent_exact_target" },
      );
    }
    const mappingByReleaseId = new Map(
      mappings.map((mapping) => [mapping.releaseId, mapping]),
    );
    const promoted = [];
    for (const release of releases) {
      const result = await promoteRelease(
        tx,
        parent,
        release,
        groupResult.group.id,
        parentRows,
        mappingByReleaseId.get(release.id),
      );
      promoted.push({ releaseId: release.id, ...result });
    }
    const representativeBottleId = promoted[0]!.bottleId;
    if (
      groupResult.group.representativeBottleId === null &&
      groupResult.group.totalBottles === 0
    ) {
      await tx
        .update(bottleGroups)
        .set({
          representativeBottleId,
          totalBottles: promoted.length,
        })
        .where(eq(bottleGroups.id, groupResult.group.id));
    } else if (
      groupResult.group.representativeBottleId !== representativeBottleId ||
      groupResult.group.totalBottles !== promoted.length
    ) {
      throw new CatalogMigrationBackfillError(
        "partial_group_graph",
        parent.id,
        null,
        { groupId: groupResult.group.id, mismatch: "family_presentation" },
      );
    }
    return {
      parentId: parent.id,
      groupId: groupResult.group.id,
      genericTargetId: groupResult.genericTargetId,
      releaseCount: releases.length,
      retainedBottleId: null,
      representativeBottleId,
      promoted,
      outcome:
        groupResult.created ||
        promoted.some(({ outcome }) => outcome === "created")
          ? "created"
          : "reused",
    };
  });
}

/** Selects an ascending page of legacy parent ids without changing data. */
export async function selectLegacyCatalogParentIds(
  { afterParentId = 0, limit = 100 }: LegacyCatalogParentCandidateOptions = {},
  database: AnyDatabase = db,
): Promise<number[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
    throw new CatalogMigrationBackfillError(
      "invalid_limit",
      afterParentId,
      null,
      { limit },
    );
  }
  return (
    await database
      .select({ id: bottles.id })
      .from(bottles)
      .where(
        and(
          gt(bottles.id, afterParentId),
          or(
            isNull(bottles.groupId),
            sql`EXISTS (
              SELECT 1 FROM ${bottleReleases}
              WHERE ${bottleReleases.bottleId} = ${bottles.id}
            )`,
          ),
        ),
      )
      .orderBy(asc(bottles.id))
      .limit(limit)
  ).map(({ id }) => id);
}
