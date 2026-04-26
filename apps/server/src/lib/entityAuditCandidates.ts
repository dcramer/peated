import { normalizeString } from "@peated/bottle-classifier/normalize";
import type {
  EntityClassificationCandidateTarget,
  EntityClassificationReason,
  EntityClassificationReference,
  EntityClassificationSampleBottle,
} from "@peated/entity-classifier";
import { db } from "@peated/server/db";
import {
  bottles,
  countries,
  entities,
  entityAliases,
  regions,
} from "@peated/server/db/schema";
import {
  findBrandRepairCandidates,
  getBrandRepairGroups,
  type BrandRepairGroup,
} from "@peated/server/lib/brandRepairCandidates";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

const DEFAULT_ENTITY_TYPE = "brand";
const MAX_BRAND_REPAIR_GROUPS = 1000;
const MAX_ENTITY_SCAN_LIMIT = 300;
const MAX_SAMPLE_BOTTLES = 5;

const GENERIC_BRAND_NAMES = new Set([
  "blend",
  "blended whisky",
  "blended whiskey",
  "bourbon",
  "bourbon whiskey",
  "canadian whisky",
  "irish whiskey",
  "japanese whisky",
  "rye",
  "rye whiskey",
  "scotch whisky",
  "single grain",
  "single grain whisky",
  "single malt",
  "single malt scotch whisky",
  "single malt whisky",
  "single pot still",
  "single pot still whiskey",
  "spirit",
  "straight bourbon whiskey",
  "straight rye whiskey",
  "whiskey",
  "whisky",
]);

const GENERIC_BRAND_WORDS = new Set([
  "american",
  "barrel",
  "batch",
  "blend",
  "blended",
  "bonded",
  "bourbon",
  "canadian",
  "cask",
  "grain",
  "irish",
  "japanese",
  "kentucky",
  "malt",
  "pot",
  "reserve",
  "rye",
  "scotch",
  "select",
  "single",
  "small",
  "spirit",
  "still",
  "straight",
  "whiskey",
  "whisky",
]);

const NAME_SUFFIX_RULES = [
  {
    label: "Whisky Distillery",
    suffix: " whisky distillery",
  },
  {
    label: "Whiskey Distillery",
    suffix: " whiskey distillery",
  },
  {
    label: "Distillery",
    suffix: " distillery",
  },
  {
    label: "Whisky",
    suffix: " whisky",
  },
  {
    label: "Whiskey",
    suffix: " whiskey",
  },
] as const;

type EntityType = "brand" | "bottler" | "distiller";

type CandidateEntity = {
  countryName: null | string;
  id: number;
  name: string;
  regionName: null | string;
  shortName: null | string;
  totalBottles: number;
  totalTastings: number;
  type: EntityType[];
  website: null | string;
};

type CandidateTargetInternal = Omit<
  EntityClassificationCandidateTarget,
  "aliases" | "supportingBottleIds"
> & {
  aliases?: string[];
  supportingBottleIds?: number[];
};

type EntityAuditCandidateInternal = {
  aliases: string[];
  candidateTargets: CandidateTargetInternal[];
  entity: CandidateEntity;
  reasons: EntityClassificationReason[];
  sortStrength: [number, number, number, number, number];
};

type BrandLookupEntry = {
  entity: CandidateEntity;
  originalName: string;
};

type NameVariant = {
  normalizedName: string;
  reason: string;
};

function normalizeComparableText(value: string): string {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getComparableWords(value: string): string[] {
  return normalizeComparableText(value).split(/\s+/).filter(Boolean);
}

function uniqueStrings(values: Array<null | string | undefined>): string[] {
  const normalized = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (normalized.has(key)) {
      continue;
    }

    normalized.add(key);
    deduped.push(trimmed);
  }

  return deduped;
}

function uniqueNumbers(values: number[]): number[] {
  return Array.from(new Set(values));
}

function compareCandidateTargets(
  left: CandidateTargetInternal,
  right: CandidateTargetInternal,
): number {
  if (right.candidateCount !== left.candidateCount) {
    return right.candidateCount - left.candidateCount;
  }

  if (right.totalTastings !== left.totalTastings) {
    return right.totalTastings - left.totalTastings;
  }

  if ((right.score ?? 0) !== (left.score ?? 0)) {
    return (right.score ?? 0) - (left.score ?? 0);
  }

  return left.name.localeCompare(right.name);
}

function compareEntityAuditCandidate(
  left: EntityAuditCandidateInternal,
  right: EntityAuditCandidateInternal,
): number {
  for (let index = 0; index < left.sortStrength.length; index += 1) {
    const diff = right.sortStrength[index]! - left.sortStrength[index]!;
    if (diff !== 0) {
      return diff;
    }
  }

  return right.entity.id - left.entity.id;
}

function buildGenericNameReason(
  name: string,
): EntityClassificationReason | null {
  const normalizedName = normalizeComparableText(name);
  if (!normalizedName) {
    return null;
  }

  if (GENERIC_BRAND_NAMES.has(normalizedName)) {
    return {
      kind: "generic_name",
      summary: "Entity name looks generic instead of producer-specific.",
      details: `${name} reads like a category or style label rather than a distinct brand identity.`,
    };
  }

  const words = normalizedName.split(" ");
  if (
    words.length >= 2 &&
    words.length <= 5 &&
    words.every((word) => GENERIC_BRAND_WORDS.has(word))
  ) {
    return {
      kind: "generic_name",
      summary: "Entity name looks generic instead of producer-specific.",
      details: `${name} is composed entirely of generic whisky style words.`,
    };
  }

  return null;
}

function buildNameVariants(name: string): NameVariant[] {
  const normalizedName = normalizeComparableText(name);
  if (!normalizedName) {
    return [];
  }

  const variants = new Map<string, NameVariant>();
  const namesToStrip = new Set([normalizedName]);

  if (normalizedName.startsWith("the ")) {
    namesToStrip.add(normalizedName.slice(4).trim());
  }

  for (const candidateName of namesToStrip) {
    for (const rule of NAME_SUFFIX_RULES) {
      if (!candidateName.endsWith(rule.suffix)) {
        continue;
      }

      const stripped = candidateName
        .slice(0, candidateName.length - rule.suffix.length)
        .trim();
      if (!stripped || stripped === normalizedName) {
        continue;
      }

      variants.set(stripped, {
        normalizedName: stripped,
        reason: `Removing the ${rule.label} suffix yields ${stripped}.`,
      });
    }
  }

  return Array.from(variants.values());
}

function buildBrandRepairReason(
  groups: BrandRepairGroup[],
): EntityClassificationReason {
  const totalCandidateCount = groups.reduce(
    (sum, group) => sum + group.candidateCount,
    0,
  );
  const targetNames = groups
    .slice(0, 3)
    .map((group) => group.targetBrand.name)
    .join(", ");

  return {
    kind: "brand_repair_group",
    summary: "Bottle evidence points at stronger existing brand rows.",
    details: `${totalCandidateCount} bottle${totalCandidateCount === 1 ? "" : "s"} currently support reassignment to ${targetNames}.`,
  };
}

function mergeCandidateTarget(
  results: Map<number, CandidateTargetInternal>,
  candidate: CandidateTargetInternal,
) {
  const existing = results.get(candidate.entityId);
  if (!existing) {
    results.set(candidate.entityId, candidate);
    return;
  }

  existing.aliases = uniqueStrings([
    ...(existing.aliases ?? []),
    ...(candidate.aliases ?? []),
  ]);
  existing.source = Array.from(
    new Set([...existing.source, ...candidate.source]),
  );
  existing.supportingBottleIds = uniqueNumbers([
    ...(existing.supportingBottleIds ?? []),
    ...(candidate.supportingBottleIds ?? []),
  ]);

  if (candidate.candidateCount > existing.candidateCount) {
    existing.candidateCount = candidate.candidateCount;
  }

  if (candidate.totalTastings > existing.totalTastings) {
    existing.totalTastings = candidate.totalTastings;
  }

  if (
    candidate.score !== null &&
    (existing.score === null || candidate.score > existing.score)
  ) {
    existing.score = candidate.score;
  }

  if (candidate.reason.length > existing.reason.length) {
    existing.reason = candidate.reason;
  }
}

async function getBrandLookup() {
  const rows = await db
    .select({
      alias: entityAliases.name,
      countryName: countries.name,
      entity: {
        id: entities.id,
        name: entities.name,
        shortName: entities.shortName,
        type: entities.type,
        website: entities.website,
        countryName: countries.name,
        regionName: regions.name,
        totalBottles: entities.totalBottles,
        totalTastings: entities.totalTastings,
      },
      regionName: regions.name,
    })
    .from(entities)
    .leftJoin(entityAliases, eq(entityAliases.entityId, entities.id))
    .leftJoin(countries, eq(countries.id, entities.countryId))
    .leftJoin(regions, eq(regions.id, entities.regionId))
    .where(sql`'brand' = ANY(${entities.type})`);

  const brandsById = new Map<number, CandidateEntity>();
  const brandAliasesById = new Map<number, string[]>();
  const lookup = new Map<string, BrandLookupEntry[]>();

  for (const row of rows) {
    brandsById.set(row.entity.id, row.entity);
    brandAliasesById.set(row.entity.id, [
      ...(brandAliasesById.get(row.entity.id) ?? []),
      ...uniqueStrings([row.alias]),
    ]);

    for (const name of uniqueStrings([
      row.entity.name,
      row.entity.shortName,
      row.alias,
    ])) {
      const normalizedName = normalizeComparableText(name);
      if (!normalizedName) {
        continue;
      }

      lookup.set(normalizedName, [
        ...(lookup.get(normalizedName) ?? []),
        {
          entity: row.entity,
          originalName: name,
        },
      ]);
    }
  }

  return {
    brandAliasesById,
    brandsById,
    lookup,
  };
}

async function getEntityRowsByIds(
  entityIds: number[],
): Promise<CandidateEntity[]> {
  if (entityIds.length === 0) {
    return [];
  }

  return await db
    .select({
      id: entities.id,
      name: entities.name,
      shortName: entities.shortName,
      type: entities.type,
      website: entities.website,
      countryName: countries.name,
      regionName: regions.name,
      totalBottles: entities.totalBottles,
      totalTastings: entities.totalTastings,
    })
    .from(entities)
    .leftJoin(countries, eq(countries.id, entities.countryId))
    .leftJoin(regions, eq(regions.id, entities.regionId))
    .where(inArray(entities.id, entityIds));
}

async function findHeuristicEntityRows({
  type,
}: {
  type: EntityType | null;
}): Promise<CandidateEntity[]> {
  const genericMatchers = Array.from(GENERIC_BRAND_NAMES).map((value) =>
    ilike(entities.name, value),
  );
  const suffixMatchers = NAME_SUFFIX_RULES.map((rule) =>
    ilike(entities.name, `%${rule.suffix.trim()}`),
  );

  return await db
    .select({
      id: entities.id,
      name: entities.name,
      shortName: entities.shortName,
      type: entities.type,
      website: entities.website,
      countryName: countries.name,
      regionName: regions.name,
      totalBottles: entities.totalBottles,
      totalTastings: entities.totalTastings,
    })
    .from(entities)
    .leftJoin(countries, eq(countries.id, entities.countryId))
    .leftJoin(regions, eq(regions.id, entities.regionId))
    .where(
      and(
        type ? sql`${type} = ANY(${entities.type})` : undefined,
        or(...genericMatchers, ...suffixMatchers),
      ),
    )
    .orderBy(desc(entities.totalTastings), desc(entities.totalBottles))
    .limit(MAX_ENTITY_SCAN_LIMIT);
}

async function findQueryMatchedEntityRows({
  query,
  type,
}: {
  query: string;
  type: EntityType | null;
}): Promise<CandidateEntity[]> {
  return await db
    .select({
      id: entities.id,
      name: entities.name,
      shortName: entities.shortName,
      type: entities.type,
      website: entities.website,
      countryName: countries.name,
      regionName: regions.name,
      totalBottles: entities.totalBottles,
      totalTastings: entities.totalTastings,
    })
    .from(entities)
    .leftJoin(countries, eq(countries.id, entities.countryId))
    .leftJoin(regions, eq(regions.id, entities.regionId))
    .where(
      and(
        type ? sql`${type} = ANY(${entities.type})` : undefined,
        or(
          ilike(entities.name, `%${query}%`),
          ilike(sql`COALESCE(${entities.shortName}, '')`, `%${query}%`),
          sql`exists(
            ${db
              .select({ n: sql`1` })
              .from(entityAliases)
              .where(
                and(
                  eq(entityAliases.entityId, entities.id),
                  ilike(entityAliases.name, `%${query}%`),
                ),
              )}
          )`,
        ),
      ),
    )
    .orderBy(desc(entities.totalTastings), desc(entities.totalBottles))
    .limit(MAX_ENTITY_SCAN_LIMIT);
}

async function findTopEntityRows({
  type,
}: {
  type: EntityType | null;
}): Promise<CandidateEntity[]> {
  return await db
    .select({
      id: entities.id,
      name: entities.name,
      shortName: entities.shortName,
      type: entities.type,
      website: entities.website,
      countryName: countries.name,
      regionName: regions.name,
      totalBottles: entities.totalBottles,
      totalTastings: entities.totalTastings,
    })
    .from(entities)
    .leftJoin(countries, eq(countries.id, entities.countryId))
    .leftJoin(regions, eq(regions.id, entities.regionId))
    .where(type ? sql`${type} = ANY(${entities.type})` : undefined)
    .orderBy(desc(entities.totalTastings), desc(entities.totalBottles))
    .limit(MAX_ENTITY_SCAN_LIMIT);
}

async function getAliasesByEntityIds(entityIds: number[]) {
  if (entityIds.length === 0) {
    return new Map<number, string[]>();
  }

  const rows = await db
    .select({
      entityId: entityAliases.entityId,
      name: entityAliases.name,
    })
    .from(entityAliases)
    .where(inArray(entityAliases.entityId, entityIds));

  const aliasesByEntityId = new Map<number, string[]>();
  for (const row of rows) {
    if (row.entityId === null) {
      continue;
    }

    aliasesByEntityId.set(row.entityId, [
      ...(aliasesByEntityId.get(row.entityId) ?? []),
      row.name,
    ]);
  }

  return new Map(
    Array.from(aliasesByEntityId.entries()).map(([entityId, aliases]) => [
      entityId,
      uniqueStrings(aliases),
    ]),
  );
}

async function getSampleBottlesByBrandIds(brandIds: number[]) {
  if (brandIds.length === 0) {
    return new Map<number, EntityClassificationSampleBottle[]>();
  }

  const rows = await db
    .select({
      brandId: bottles.brandId,
      category: bottles.category,
      fullName: bottles.fullName,
      id: bottles.id,
      name: bottles.name,
      totalTastings: bottles.totalTastings,
    })
    .from(bottles)
    .where(inArray(bottles.brandId, brandIds))
    .orderBy(desc(bottles.totalTastings), desc(bottles.id));

  const samplesByBrandId = new Map<
    number,
    EntityClassificationSampleBottle[]
  >();

  for (const row of rows) {
    if (row.brandId === null) {
      continue;
    }

    const existing = samplesByBrandId.get(row.brandId) ?? [];
    if (existing.length >= MAX_SAMPLE_BOTTLES) {
      continue;
    }

    samplesByBrandId.set(row.brandId, [
      ...existing,
      {
        id: row.id,
        fullName: row.fullName,
        name: row.name,
        category: row.category,
        totalTastings: row.totalTastings,
      },
    ]);
  }

  return samplesByBrandId;
}

function buildSuffixTargetCandidates({
  brandAliasesById,
  brandLookup,
  entity,
}: {
  brandAliasesById: Map<number, string[]>;
  brandLookup: Map<string, BrandLookupEntry[]>;
  entity: CandidateEntity;
}): CandidateTargetInternal[] {
  const targets = new Map<number, CandidateTargetInternal>();

  for (const variant of buildNameVariants(entity.name)) {
    for (const entry of brandLookup.get(variant.normalizedName) ?? []) {
      if (entry.entity.id === entity.id) {
        continue;
      }

      mergeCandidateTarget(targets, {
        entityId: entry.entity.id,
        name: entry.entity.name,
        shortName: entry.entity.shortName,
        aliases: brandAliasesById.get(entry.entity.id) ?? [],
        type: entry.entity.type,
        website: entry.entity.website,
        score: 0.7,
        candidateCount: 0,
        totalTastings: entry.entity.totalTastings,
        supportingBottleIds: [],
        reason: `${variant.reason} ${entry.entity.name} already exists locally as a brand.`,
        source: ["name_suffix_sibling"],
      });
    }
  }

  return Array.from(targets.values()).sort(compareCandidateTargets);
}

function buildBrandRepairTargets({
  brandAliasesById,
  brandsById,
  groups,
}: {
  brandAliasesById: Map<number, string[]>;
  brandsById: Map<number, CandidateEntity>;
  groups: BrandRepairGroup[];
}): CandidateTargetInternal[] {
  return groups.map((group) => {
    const targetBrand = brandsById.get(group.targetBrand.id);

    return {
      entityId: group.targetBrand.id,
      name: group.targetBrand.name,
      shortName: targetBrand?.shortName ?? group.targetBrand.shortName,
      aliases: brandAliasesById.get(group.targetBrand.id) ?? [],
      type: targetBrand?.type ?? ["brand"],
      website: targetBrand?.website ?? null,
      score: null,
      candidateCount: group.candidateCount,
      totalTastings: group.totalTastings,
      supportingBottleIds: [],
      reason: `${group.candidateCount} bottle${group.candidateCount === 1 ? "" : "s"} already match ${group.targetBrand.name} from bottle title or alias evidence.`,
      source: ["grouped_brand_repair"],
    };
  });
}

function buildCandidate({
  brandAliasesById,
  brandsById,
  brandLookup,
  entity,
  entityAliases,
  groupedBrandRepairs,
}: {
  brandAliasesById: Map<number, string[]>;
  brandsById: Map<number, CandidateEntity>;
  brandLookup: Map<string, BrandLookupEntry[]>;
  entity: CandidateEntity;
  entityAliases: string[];
  groupedBrandRepairs: BrandRepairGroup[];
}): EntityAuditCandidateInternal | null {
  const reasons: EntityClassificationReason[] = [];
  const candidateTargets = new Map<number, CandidateTargetInternal>();

  if (groupedBrandRepairs.length > 0) {
    reasons.push(buildBrandRepairReason(groupedBrandRepairs));
    for (const target of buildBrandRepairTargets({
      brandAliasesById,
      brandsById,
      groups: groupedBrandRepairs,
    })) {
      mergeCandidateTarget(candidateTargets, target);
    }
  }

  const genericNameReason = buildGenericNameReason(entity.name);
  if (genericNameReason) {
    reasons.push(genericNameReason);
  }

  const suffixTargets = buildSuffixTargetCandidates({
    brandAliasesById,
    brandLookup,
    entity,
  });
  if (suffixTargets.length > 0) {
    reasons.push({
      kind: "name_suffix_conflict",
      summary: "Entity name collapses to an existing sibling brand.",
      details: suffixTargets
        .slice(0, 3)
        .map((target) => target.name)
        .join(", "),
    });
    for (const target of suffixTargets) {
      mergeCandidateTarget(candidateTargets, target);
    }
  }

  const mergedTargets = Array.from(candidateTargets.values()).sort(
    compareCandidateTargets,
  );

  if (reasons.length === 0 && mergedTargets.length === 0) {
    return null;
  }

  const maxCandidateCount = mergedTargets[0]?.candidateCount ?? 0;
  const totalCandidateCount = mergedTargets.reduce(
    (sum, target) => sum + target.candidateCount,
    0,
  );

  return {
    aliases: entityAliases,
    candidateTargets: mergedTargets,
    entity,
    reasons,
    sortStrength: [
      maxCandidateCount,
      totalCandidateCount,
      reasons.length,
      entity.totalTastings,
      entity.totalBottles,
    ],
  };
}

async function materializeCandidates(
  candidates: EntityAuditCandidateInternal[],
): Promise<EntityClassificationReference[]> {
  if (candidates.length === 0) {
    return [];
  }

  const sourceIds = candidates.map((candidate) => candidate.entity.id);
  const targetIds = uniqueNumbers(
    candidates.flatMap((candidate) =>
      candidate.candidateTargets.map((target) => target.entityId),
    ),
  );
  const [sourceAliasesById, targetAliasesById, sampleBottlesByBrandId] =
    await Promise.all([
      getAliasesByEntityIds(sourceIds),
      getAliasesByEntityIds(targetIds),
      getSampleBottlesByBrandIds(
        candidates
          .filter((candidate) => candidate.entity.type.includes("brand"))
          .map((candidate) => candidate.entity.id),
      ),
    ]);

  const groupedBottleIdsByKey = new Map<string, number[]>();

  await Promise.all(
    candidates.flatMap((candidate) =>
      candidate.candidateTargets
        .filter((target) => target.source.includes("grouped_brand_repair"))
        .map(async (target) => {
          const key = `${candidate.entity.id}:${target.entityId}`;
          if (groupedBottleIdsByKey.has(key)) {
            return;
          }

          const supportingCandidates = await findBrandRepairCandidates({
            currentBrandId: candidate.entity.id,
            targetBrandId: target.entityId,
          });
          groupedBottleIdsByKey.set(
            key,
            supportingCandidates.map((item) => item.bottle.id),
          );
        }),
    ),
  );

  return candidates.map((candidate) => ({
    entity: {
      ...candidate.entity,
      aliases: uniqueStrings([
        candidate.entity.name,
        ...(sourceAliasesById.get(candidate.entity.id) ?? candidate.aliases),
      ]),
    },
    reasons: candidate.reasons,
    sampleBottles: sampleBottlesByBrandId.get(candidate.entity.id) ?? [],
    candidateTargets: candidate.candidateTargets.map((target) => {
      const groupedBottleIds =
        groupedBottleIdsByKey.get(
          `${candidate.entity.id}:${target.entityId}`,
        ) ??
        target.supportingBottleIds ??
        [];

      return {
        ...target,
        aliases: uniqueStrings([
          target.name,
          ...(targetAliasesById.get(target.entityId) ?? target.aliases ?? []),
        ]),
        candidateCount: target.source.includes("grouped_brand_repair")
          ? groupedBottleIds.length
          : target.candidateCount,
        supportingBottleIds: groupedBottleIds,
      };
    }),
  }));
}

async function collectEntityAuditCandidates({
  entityId,
  query = "",
  type = DEFAULT_ENTITY_TYPE,
}: {
  entityId?: number;
  query?: string;
  type?: EntityType | null;
}): Promise<EntityAuditCandidateInternal[]> {
  const trimmedQuery = query.trim();
  const { brandAliasesById, brandsById, lookup } = await getBrandLookup();

  if (entityId) {
    const [entity] = await getEntityRowsByIds([entityId]);
    if (!entity) {
      return [];
    }

    const aliasesById = await getAliasesByEntityIds([entity.id]);
    const groupedBrandRepairs =
      entity.type.includes("brand") && (type === null || type === "brand")
        ? (
            await getBrandRepairGroups({
              currentBrandId: entity.id,
              limit: MAX_BRAND_REPAIR_GROUPS,
            })
          ).results
        : [];

    const candidate = buildCandidate({
      brandAliasesById,
      brandsById,
      brandLookup: lookup,
      entity,
      entityAliases: aliasesById.get(entity.id) ?? [],
      groupedBrandRepairs,
    });

    return candidate ? [candidate] : [];
  }

  const groupedBrandRepairs =
    type === null || type === "brand"
      ? (
          await getBrandRepairGroups({
            cursor: 1,
            limit: MAX_BRAND_REPAIR_GROUPS,
            query: trimmedQuery,
          })
        ).results
      : [];

  const subjectIds = new Set<number>();

  for (const group of groupedBrandRepairs) {
    subjectIds.add(group.currentBrand.id);
  }

  const [queryMatchedEntities, topEntities, heuristicEntities] =
    await Promise.all([
      trimmedQuery
        ? findQueryMatchedEntityRows({
            query: trimmedQuery,
            type,
          })
        : Promise.resolve([]),
      trimmedQuery
        ? Promise.resolve([])
        : findTopEntityRows({
            type,
          }),
      trimmedQuery
        ? Promise.resolve([])
        : findHeuristicEntityRows({
            type,
          }),
    ]);

  for (const entity of [
    ...queryMatchedEntities,
    ...topEntities,
    ...heuristicEntities,
  ]) {
    subjectIds.add(entity.id);
  }

  const entityRows = await getEntityRowsByIds(Array.from(subjectIds));
  const aliasesById = await getAliasesByEntityIds(
    entityRows.map((entity) => entity.id),
  );
  const groupsByBrandId = new Map<number, BrandRepairGroup[]>();

  for (const group of groupedBrandRepairs) {
    groupsByBrandId.set(group.currentBrand.id, [
      ...(groupsByBrandId.get(group.currentBrand.id) ?? []),
      group,
    ]);
  }

  const results: EntityAuditCandidateInternal[] = [];

  for (const entity of entityRows) {
    const candidate = buildCandidate({
      brandAliasesById,
      brandsById,
      brandLookup: lookup,
      entity,
      entityAliases: aliasesById.get(entity.id) ?? [],
      groupedBrandRepairs: groupsByBrandId.get(entity.id) ?? [],
    });

    if (!candidate) {
      continue;
    }

    results.push(candidate);
  }

  results.sort(compareEntityAuditCandidate);
  return results;
}

export async function getEntityClassificationReference({
  entity,
  includeManualFallback = true,
}: {
  entity: number;
  includeManualFallback?: boolean;
}): Promise<EntityClassificationReference | null> {
  const [candidate] = await collectEntityAuditCandidates({
    entityId: entity,
    type: null,
  });

  if (!candidate) {
    if (!includeManualFallback) {
      return null;
    }

    const [entityRow] = await getEntityRowsByIds([entity]);
    if (!entityRow) {
      return null;
    }

    const aliasesById = await getAliasesByEntityIds([entityRow.id]);
    const [reference] = await materializeCandidates([
      {
        aliases: aliasesById.get(entityRow.id) ?? [],
        candidateTargets: [],
        entity: entityRow,
        reasons: [
          {
            kind: "manual_audit",
            summary: "Manual audit requested for this entity.",
            details: null,
          },
        ],
        sortStrength: [
          0,
          0,
          1,
          entityRow.totalTastings,
          entityRow.totalBottles,
        ],
      },
    ]);

    return reference ?? null;
  }

  const [reference] = await materializeCandidates([candidate]);
  if (!reference) {
    return null;
  }

  if (reference.reasons.length === 0) {
    reference.reasons.push({
      kind: "manual_audit",
      summary: "Manual audit requested for this entity.",
      details: null,
    });
  }

  return reference;
}

export async function getEntityAuditCandidates({
  cursor = 1,
  limit = 25,
  query = "",
  type = DEFAULT_ENTITY_TYPE,
}: {
  cursor?: number;
  limit?: number;
  query?: string;
  type?: EntityType | null;
}) {
  const candidates = await collectEntityAuditCandidates({
    query,
    type,
  });

  const start = (cursor - 1) * limit;
  const pagedCandidates = candidates.slice(start, start + limit);
  const nextCursor = start + limit < candidates.length ? cursor + 1 : null;
  const prevCursor = cursor > 1 ? cursor - 1 : null;

  return {
    results: await materializeCandidates(pagedCandidates),
    rel: {
      nextCursor,
      prevCursor,
    },
  };
}
