import { normalizeString } from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroupTombstones,
  bottleReleasePromotions,
  bottleReleases,
  bottles,
  bottleTombstones,
  catalogTargets,
  entities,
  entityAliases,
} from "@peated/server/db/schema";
import {
  loadCatalogTargetReadsWithParity,
  loadLegacyCatalogTargetReadBatch,
  recordCatalogTargetReadFilterParity,
} from "@peated/server/lib/catalogTargetReadParity";
import {
  CatalogTargetResolutionError,
  loadCatalogTargetBatch,
} from "@peated/server/lib/catalogTargets";
import type { CatalogTargetV1 } from "@peated/server/schemas";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const MAX_PREFIX_WORDS = 8;
const MAX_SCAN_LIMIT = 2000;

// These words can appear in real entity names, but prefix expansion alone
// cannot prove that the bottle brand should move to that entity.
const GENERIC_BRAND_EXPANSION_WORDS = new Set([
  "barrel",
  "batch",
  "bourbon",
  "brandy",
  "cask",
  "co",
  "cognac",
  "company",
  "distiller",
  "distillery",
  "gin",
  "house",
  "liqueur",
  "malt",
  "mezcal",
  "private",
  "proof",
  "reserve",
  "rum",
  "rye",
  "scotch",
  "select",
  "single",
  "small",
  "special",
  "spirit",
  "spirits",
  "straight",
  "tequila",
  "vodka",
  "whiskey",
  "whisky",
]);

const GENERIC_SOURCE_BRAND_NAMES = new Set([
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

const GENERIC_SOURCE_BRAND_WORDS = new Set([
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

type CandidateBottle = Pick<
  typeof bottles.$inferSelect,
  "brandId" | "fullName" | "id" | "name" | "numReleases" | "totalTastings"
>;

type CandidateBrand = Pick<
  typeof entities.$inferSelect,
  "id" | "name" | "shortName" | "totalBottles" | "totalTastings" | "type"
>;

type BrandNameEntry = {
  entityId: number;
  normalizedName: string;
  originalName: string;
  wordCount: number;
};

export type BrandRepairSupportingReference = {
  currentBrandMatchedName: null | string;
  currentBrandMatchedWordCount: number;
  source: "alias" | "full_name";
  targetMatchedName: string;
  targetMatchedWordCount: number;
  text: string;
};

export type BrandRepairCandidate = {
  bottle: {
    fullName: string;
    id: number;
    name: string;
    numReleases: number;
    totalTastings: null | number;
  };
  currentBrand: {
    id: number;
    name: string;
    shortName: null | string;
    totalBottles: number;
    totalTastings: number;
  };
  suggestedDistillery: null | {
    id: number;
    name: string;
  };
  supportingReferences: BrandRepairSupportingReference[];
  targetBrand: {
    id: number;
    name: string;
    shortName: null | string;
    totalBottles: number;
    totalTastings: number;
  };
};

export type BrandRepairGroup = {
  candidateCount: number;
  currentBrand: BrandRepairCandidate["currentBrand"];
  sampleBottles: Array<{
    bottle: BrandRepairCandidate["bottle"];
    supportingReferences: BrandRepairSupportingReference[];
  }>;
  suggestedDistillery: BrandRepairCandidate["suggestedDistillery"];
  targetBrand: BrandRepairCandidate["targetBrand"];
  totalTastings: number;
};

type BrandRepairCandidateInternal = BrandRepairCandidate & {
  sortStrength: [number, number, number, number];
};

type RankedTargetCandidate = {
  currentBrand: CandidateBrand;
  sortStrength: [number, number, number, number];
  supportingReferences: BrandRepairSupportingReference[];
  targetBrand: CandidateBrand;
};

type AliasRow = Pick<
  typeof bottleAliases.$inferSelect,
  "bottleId" | "name" | "releaseId" | "targetId"
>;

type AliasParityRow = AliasRow & {
  targetBottleId: number | null;
  targetBrandId: number | null;
};

const MAX_PARITY_SAMPLE = 100;
const aliasTargetBottles = alias(bottles, "brand_repair_alias_target_bottle");
const aliasLegacyBottles = alias(bottles, "brand_repair_alias_legacy_bottle");
const aliasPromotedBottles = alias(
  bottles,
  "brand_repair_alias_promoted_bottle",
);
const aliasReadContext = {
  actor: null,
  permissions: { canReadCatalogIdentity: true },
} as const;

function activeExactBottleTargetJoin() {
  return and(
    eq(bottles.id, catalogTargets.bottleId),
    eq(bottles.groupId, catalogTargets.groupId),
  );
}

function activeExactBottleConditions() {
  return and(
    sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
    sql`NOT EXISTS(SELECT FROM ${bottleGroupTombstones} WHERE ${bottleGroupTombstones.groupId} = ${catalogTargets.groupId})`,
  );
}

/** Alias repair evidence belongs only to its validated live exact target. */
async function loadAuthoritativeAliasMembership(
  rows: AliasRow[],
  targetMatches: (bottleId: number, brandId: number) => boolean,
): Promise<Array<{ bottleId: number; name: string }>> {
  const targetIds = rows.flatMap(({ targetId }) =>
    targetId === null ? [] : [targetId],
  );
  const resolutions = await loadCatalogTargetBatch(targetIds, aliasReadContext);

  return rows.flatMap((row) => {
    if (row.targetId === null) return [];
    const resolution = resolutions.get(row.targetId);
    if (!resolution) {
      throw new Error(`Missing CatalogTarget batch result: ${row.targetId}`);
    }
    if (!resolution.ok) throw resolution.error;
    const { target } = resolution;
    if (
      target.kind !== "bottle" ||
      !targetMatches(target.bottle.id, target.bottle.brandId)
    ) {
      return [];
    }
    return [{ bottleId: target.bottle.id, name: row.name }];
  });
}

async function recordAliasMembershipParity({
  filter,
  legacyMatches,
  operation,
  rows,
  targetMatches,
}: {
  filter: "catalog_reference" | "entity" | "query";
  legacyMatches: (
    row: AliasParityRow,
    legacyTarget: CatalogTargetV1 | null,
  ) => boolean;
  operation: string;
  rows: AliasParityRow[];
  targetMatches: (row: AliasParityRow) => boolean;
}): Promise<void> {
  const parityItems = rows.map((row) => ({
    consumerTable: "bottle_alias" as const,
    rowLocator: { name: row.name },
    targetId: row.targetId,
    legacy: {
      bottleId: row.bottleId,
      releaseId: row.releaseId,
    },
  }));
  const context = {
    ...aliasReadContext,
    caller: "brandRepairCandidates",
    operation,
  } as const;

  let legacyTargets: (CatalogTargetV1 | null)[];
  try {
    ({ legacyTargets } = await loadCatalogTargetReadsWithParity(
      parityItems,
      context,
    ));
  } catch (error) {
    // Parity-only durable errors cannot control results; authoritative rows are
    // validated independently before they contribute alias evidence.
    if (!(error instanceof CatalogTargetResolutionError)) throw error;
    legacyTargets = (
      await loadLegacyCatalogTargetReadBatch(
        parityItems.map(({ legacy }) => legacy),
        context,
      )
    ).map(({ target }) => target);
  }

  recordCatalogTargetReadFilterParity(
    rows.map((row, index) => {
      const parityItem = parityItems[index];
      if (!parityItem) {
        throw new Error(`Missing alias parity item: ${index}`);
      }
      return {
        ...parityItem,
        filter,
        targetMatches: targetMatches(row),
        legacyMatches: legacyMatches(row, legacyTargets[index] ?? null),
      };
    }),
    context,
  );
}

async function getQueryAliasMembership({
  currentBrandId,
  query,
}: {
  currentBrandId?: number;
  query: string;
}): Promise<Array<{ bottleId: number; name: string }>> {
  const authoritativeRows = await db
    .select({
      bottleId: bottleAliases.bottleId,
      name: bottleAliases.name,
      releaseId: bottleAliases.releaseId,
      targetId: bottleAliases.targetId,
    })
    .from(bottleAliases)
    .innerJoin(catalogTargets, eq(catalogTargets.id, bottleAliases.targetId))
    .innerJoin(
      aliasTargetBottles,
      eq(aliasTargetBottles.id, catalogTargets.bottleId),
    )
    .where(
      and(
        eq(bottleAliases.ignored, false),
        ilike(bottleAliases.name, `%${query}%`),
        isNotNull(catalogTargets.bottleId),
        currentBrandId
          ? eq(aliasTargetBottles.brandId, currentBrandId)
          : undefined,
      ),
    )
    .orderBy(asc(bottleAliases.name))
    .limit(MAX_SCAN_LIMIT);

  const parityRows = await db
    .select({
      bottleId: bottleAliases.bottleId,
      name: bottleAliases.name,
      releaseId: bottleAliases.releaseId,
      targetBottleId: aliasTargetBottles.id,
      targetBrandId: aliasTargetBottles.brandId,
      targetId: bottleAliases.targetId,
    })
    .from(bottleAliases)
    .leftJoin(catalogTargets, eq(catalogTargets.id, bottleAliases.targetId))
    .leftJoin(
      aliasTargetBottles,
      eq(aliasTargetBottles.id, catalogTargets.bottleId),
    )
    .leftJoin(
      aliasLegacyBottles,
      eq(aliasLegacyBottles.id, bottleAliases.bottleId),
    )
    .leftJoin(
      bottleReleases,
      and(
        eq(bottleReleases.id, bottleAliases.releaseId),
        eq(bottleReleases.bottleId, bottleAliases.bottleId),
      ),
    )
    .leftJoin(
      bottleReleasePromotions,
      and(
        eq(bottleReleasePromotions.releaseId, bottleReleases.id),
        eq(bottleReleasePromotions.status, "promoted"),
      ),
    )
    .leftJoin(
      aliasPromotedBottles,
      eq(aliasPromotedBottles.id, bottleReleasePromotions.promotedBottleId),
    )
    .where(
      and(
        eq(bottleAliases.ignored, false),
        ilike(bottleAliases.name, `%${query}%`),
        currentBrandId
          ? or(
              eq(aliasTargetBottles.brandId, currentBrandId),
              eq(aliasLegacyBottles.brandId, currentBrandId),
              eq(aliasPromotedBottles.brandId, currentBrandId),
            )
          : undefined,
      ),
    )
    .orderBy(asc(bottleAliases.name))
    .limit(MAX_PARITY_SAMPLE);

  await recordAliasMembershipParity({
    filter: currentBrandId ? "entity" : "query",
    legacyMatches: (_row, target) =>
      target?.kind === "bottle" &&
      (currentBrandId === undefined ||
        target.bottle.brandId === currentBrandId),
    operation: "query_alias_membership",
    rows: parityRows,
    targetMatches: (row) =>
      row.targetBottleId !== null &&
      (currentBrandId === undefined || row.targetBrandId === currentBrandId),
  });

  return await loadAuthoritativeAliasMembership(
    authoritativeRows,
    (_bottleId, brandId) =>
      currentBrandId === undefined || brandId === currentBrandId,
  );
}

async function getSupportingAliasMembership(
  candidateBottleIds: number[],
): Promise<Array<{ bottleId: number; name: string }>> {
  const candidateIds = new Set(candidateBottleIds);
  const authoritativeRows = await db
    .select({
      bottleId: bottleAliases.bottleId,
      name: bottleAliases.name,
      releaseId: bottleAliases.releaseId,
      targetId: bottleAliases.targetId,
    })
    .from(bottleAliases)
    .innerJoin(catalogTargets, eq(catalogTargets.id, bottleAliases.targetId))
    .where(
      and(
        eq(bottleAliases.ignored, false),
        inArray(catalogTargets.bottleId, candidateBottleIds),
      ),
    )
    .orderBy(asc(bottleAliases.name));

  const parityRows = await db
    .select({
      bottleId: bottleAliases.bottleId,
      name: bottleAliases.name,
      releaseId: bottleAliases.releaseId,
      targetBottleId: catalogTargets.bottleId,
      targetBrandId: aliasTargetBottles.brandId,
      targetId: bottleAliases.targetId,
    })
    .from(bottleAliases)
    .leftJoin(catalogTargets, eq(catalogTargets.id, bottleAliases.targetId))
    .leftJoin(
      aliasTargetBottles,
      eq(aliasTargetBottles.id, catalogTargets.bottleId),
    )
    .leftJoin(
      bottleReleases,
      and(
        eq(bottleReleases.id, bottleAliases.releaseId),
        eq(bottleReleases.bottleId, bottleAliases.bottleId),
      ),
    )
    .leftJoin(
      bottleReleasePromotions,
      and(
        eq(bottleReleasePromotions.releaseId, bottleReleases.id),
        eq(bottleReleasePromotions.status, "promoted"),
      ),
    )
    .where(
      and(
        eq(bottleAliases.ignored, false),
        or(
          inArray(catalogTargets.bottleId, candidateBottleIds),
          inArray(bottleAliases.bottleId, candidateBottleIds),
          inArray(bottleReleasePromotions.promotedBottleId, candidateBottleIds),
        ),
      ),
    )
    .orderBy(asc(bottleAliases.name))
    .limit(MAX_PARITY_SAMPLE);

  await recordAliasMembershipParity({
    filter: "catalog_reference",
    legacyMatches: (_row, target) =>
      target?.kind === "bottle" && candidateIds.has(target.bottle.id),
    operation: "supporting_alias_membership",
    rows: parityRows,
    targetMatches: (row) =>
      row.targetBottleId !== null && candidateIds.has(row.targetBottleId),
  });

  return await loadAuthoritativeAliasMembership(authoritativeRows, (bottleId) =>
    candidateIds.has(bottleId),
  );
}

function normalizeComparableText(value: string): string {
  return normalizeString(value).toLowerCase().trim();
}

function getComparableWords(value: string): string[] {
  return normalizeComparableText(value)
    .replace(/[^a-z0-9']+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function getNameWordVariants(
  ...names: Array<null | string | undefined>
): string[][] {
  const variants: string[][] = [];
  const seen = new Set<string>();

  for (const name of names) {
    const words = getComparableWords(name ?? "");
    if (words.length === 0) {
      continue;
    }

    for (const variant of [
      words,
      ...(words[0] === "the" && words.length > 1 ? [words.slice(1)] : []),
    ]) {
      const key = variant.join(" ");
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      variants.push(variant);
    }
  }

  return variants;
}

function getLeadingComparablePhrases(value: string): string[] {
  const words = getComparableWords(value);

  return Array.from(
    new Set(
      Array.from({
        length: Math.min(words.length, MAX_PREFIX_WORDS),
      }).map((_, index) => words.slice(0, index + 1).join(" ")),
    ),
  );
}

function containsWordSequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) {
    return false;
  }

  return haystack.some((_, index) =>
    needle.every((word, needleIndex) => haystack[index + needleIndex] === word),
  );
}

function startsWithWordSequence(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) {
    return false;
  }

  return needle.every((word, index) => haystack[index] === word);
}

function targetNameIsCurrentDistilleryBrandContraction({
  currentBrand,
  targetBrand,
}: {
  currentBrand: CandidateBrand;
  targetBrand: CandidateBrand;
}): boolean {
  // Alias-only contractions are safe only when the current entity is also a
  // distiller; otherwise stale aliases can create reversible brand repairs.
  if (!currentBrand.type.includes("distiller")) {
    return false;
  }

  const currentNameVariants = getNameWordVariants(
    currentBrand.name,
    currentBrand.shortName,
  );
  const targetNameVariants = [
    ...getNameWordVariants(targetBrand.name),
    ...getNameWordVariants(targetBrand.shortName).filter(
      (words) => words.length > 1,
    ),
  ];

  return currentNameVariants.some((currentWords) =>
    targetNameVariants.some((targetWords) =>
      containsWordSequence(currentWords, targetWords),
    ),
  );
}

function isGenericProductBrandExpansion({
  currentBrand,
  targetBrand,
}: {
  currentBrand: CandidateBrand;
  targetBrand: CandidateBrand;
}): boolean {
  // Product/category suffixes create brand-vs-product ambiguity, not
  // deterministic repair evidence.
  const currentNameVariants = getNameWordVariants(
    currentBrand.name,
    currentBrand.shortName,
  );
  const targetNameVariants = getNameWordVariants(targetBrand.name);

  return currentNameVariants.some((currentWords) =>
    targetNameVariants.some((targetWords) => {
      if (
        targetWords.length <= currentWords.length ||
        !startsWithWordSequence(targetWords, currentWords)
      ) {
        return false;
      }

      return targetWords
        .slice(currentWords.length)
        .every((word) => GENERIC_BRAND_EXPANSION_WORDS.has(word));
    }),
  );
}

function isGenericSourceBrandName(name: null | string | undefined): boolean {
  const normalizedName = getComparableWords(name ?? "").join(" ");
  if (!normalizedName) {
    return false;
  }

  if (GENERIC_SOURCE_BRAND_NAMES.has(normalizedName)) {
    return true;
  }

  return normalizedName
    .split(" ")
    .every((word) => GENERIC_SOURCE_BRAND_WORDS.has(word));
}

function hasDeterministicRepairScope({
  currentBrand,
  targetBrand,
}: {
  currentBrand: CandidateBrand;
  targetBrand: CandidateBrand;
}): boolean {
  if (
    isGenericSourceBrandName(currentBrand.name) ||
    isGenericSourceBrandName(currentBrand.shortName)
  ) {
    return true;
  }

  return targetNameIsCurrentDistilleryBrandContraction({
    currentBrand,
    targetBrand,
  });
}

function hasSafeAliasOnlyBrandRepairSupport({
  currentBrand,
  hasCanonicalCurrentBrandMatch,
  supportingReferences,
  targetBrand,
}: {
  currentBrand: CandidateBrand;
  hasCanonicalCurrentBrandMatch: boolean;
  supportingReferences: BrandRepairSupportingReference[];
  targetBrand: CandidateBrand;
}): boolean {
  if (!hasCanonicalCurrentBrandMatch) {
    return true;
  }

  if (
    supportingReferences.some((reference) => reference.source === "full_name")
  ) {
    return true;
  }

  if (
    supportingReferences.some(
      (reference) =>
        reference.source === "alias" &&
        reference.currentBrandMatchedWordCount > 0,
    )
  ) {
    return true;
  }

  // Retail aliases often prepend an owner before the actual bottle brand; that
  // should not rewrite the bottle unless the current entity is a distillery.
  return targetNameIsCurrentDistilleryBrandContraction({
    currentBrand,
    targetBrand,
  });
}

function registerBrandName(
  index: Map<string, BrandNameEntry[]>,
  brandNamesById: Map<number, BrandNameEntry[]>,
  brand: CandidateBrand,
  name: null | string | undefined,
) {
  if (!name) {
    return;
  }

  const normalizedName = getComparableWords(name).join(" ");
  if (!normalizedName) {
    return;
  }

  const entry: BrandNameEntry = {
    entityId: brand.id,
    normalizedName,
    originalName: name,
    wordCount: normalizedName.split(" ").length,
  };

  const existingEntries = brandNamesById.get(brand.id) ?? [];
  if (
    existingEntries.some((value) => value.normalizedName === normalizedName)
  ) {
    return;
  }

  brandNamesById.set(brand.id, [...existingEntries, entry]);
  index.set(normalizedName, [...(index.get(normalizedName) ?? []), entry]);
}

function getBestCurrentBrandMatch({
  brandNames,
  text,
}: {
  brandNames: BrandNameEntry[];
  text: string;
}): BrandNameEntry | null {
  const leadingPhrases = new Set(getLeadingComparablePhrases(text));
  const matchingEntries = brandNames.filter((entry) =>
    leadingPhrases.has(entry.normalizedName),
  );

  if (matchingEntries.length === 0) {
    return null;
  }

  return matchingEntries.sort((left, right) => {
    if (right.wordCount !== left.wordCount) {
      return right.wordCount - left.wordCount;
    }

    return right.originalName.length - left.originalName.length;
  })[0]!;
}

function compareSupportingReferenceQuality(
  left: BrandRepairSupportingReference,
  right: BrandRepairSupportingReference,
): number {
  if (right.targetMatchedWordCount !== left.targetMatchedWordCount) {
    return right.targetMatchedWordCount - left.targetMatchedWordCount;
  }

  if (left.source !== right.source) {
    return left.source === "alias" ? -1 : 1;
  }

  return right.text.length - left.text.length;
}

function candidateMatchesQuery(
  candidate: BrandRepairCandidateInternal,
  normalizedQuery: string,
): boolean {
  return [
    candidate.bottle.fullName,
    candidate.bottle.name,
    candidate.currentBrand.name,
    candidate.currentBrand.shortName,
    candidate.targetBrand.name,
    candidate.targetBrand.shortName,
    candidate.suggestedDistillery?.name,
    ...candidate.supportingReferences.flatMap((reference) => [
      reference.text,
      reference.targetMatchedName,
      reference.currentBrandMatchedName,
    ]),
  ].some((value) =>
    value ? normalizeComparableText(value).includes(normalizedQuery) : false,
  );
}

function compareBrandRepairCandidate(
  left: BrandRepairCandidateInternal,
  right: BrandRepairCandidateInternal,
): number {
  for (let index = 0; index < left.sortStrength.length; index += 1) {
    const diff = right.sortStrength[index]! - left.sortStrength[index]!;
    if (diff !== 0) {
      return diff;
    }
  }

  return right.bottle.id - left.bottle.id;
}

function toPublicCandidate(
  candidate: BrandRepairCandidateInternal,
): BrandRepairCandidate {
  const { sortStrength: _sortStrength, ...publicCandidate } = candidate;
  return publicCandidate;
}

async function getCandidateBottles({
  currentBrandId,
  query,
}: {
  currentBrandId?: number;
  query: string;
}): Promise<CandidateBottle[]> {
  if (currentBrandId) {
    if (!query) {
      return await db
        .select({
          brandId: bottles.brandId,
          fullName: bottles.fullName,
          id: bottles.id,
          name: bottles.name,
          numReleases: bottles.numReleases,
          totalTastings: bottles.totalTastings,
        })
        .from(bottles)
        .innerJoin(catalogTargets, activeExactBottleTargetJoin())
        .where(
          and(
            eq(bottles.brandId, currentBrandId),
            activeExactBottleConditions(),
          ),
        )
        .orderBy(desc(bottles.totalTastings), desc(bottles.id))
        .limit(MAX_SCAN_LIMIT);
    }

    const [matchingBottleRows, matchingAliasRows] = await Promise.all([
      db
        .select({ id: bottles.id })
        .from(bottles)
        .innerJoin(catalogTargets, activeExactBottleTargetJoin())
        .where(
          and(
            eq(bottles.brandId, currentBrandId),
            ilike(bottles.fullName, `%${query}%`),
            activeExactBottleConditions(),
          ),
        )
        .limit(MAX_SCAN_LIMIT),
      getQueryAliasMembership({ currentBrandId, query }),
    ]);

    const bottleIds = new Set<number>();
    for (const { id } of matchingBottleRows) {
      bottleIds.add(id);
    }

    for (const row of matchingAliasRows) {
      bottleIds.add(row.bottleId);
    }

    if (bottleIds.size === 0) {
      return [];
    }

    return await db
      .select({
        brandId: bottles.brandId,
        fullName: bottles.fullName,
        id: bottles.id,
        name: bottles.name,
        numReleases: bottles.numReleases,
        totalTastings: bottles.totalTastings,
      })
      .from(bottles)
      .innerJoin(catalogTargets, activeExactBottleTargetJoin())
      .where(
        and(
          eq(bottles.brandId, currentBrandId),
          inArray(bottles.id, Array.from(bottleIds).slice(0, MAX_SCAN_LIMIT)),
          activeExactBottleConditions(),
        ),
      )
      .orderBy(desc(bottles.totalTastings), desc(bottles.id));
  }

  if (!query) {
    return await db
      .select({
        brandId: bottles.brandId,
        fullName: bottles.fullName,
        id: bottles.id,
        name: bottles.name,
        numReleases: bottles.numReleases,
        totalTastings: bottles.totalTastings,
      })
      .from(bottles)
      .innerJoin(catalogTargets, activeExactBottleTargetJoin())
      .where(and(isNotNull(bottles.brandId), activeExactBottleConditions()))
      .orderBy(desc(bottles.totalTastings), desc(bottles.id))
      .limit(MAX_SCAN_LIMIT);
  }

  const [matchingBrandRows, matchingBottleRows, matchingAliasRows] =
    await Promise.all([
      db
        .select({ id: entities.id })
        .from(entities)
        .leftJoin(entityAliases, eq(entityAliases.entityId, entities.id))
        .where(
          and(
            sql`'brand' = ANY(${entities.type})`,
            or(
              ilike(entities.name, `%${query}%`),
              ilike(sql`COALESCE(${entities.shortName}, '')`, `%${query}%`),
              ilike(sql`COALESCE(${entityAliases.name}, '')`, `%${query}%`),
            ),
          ),
        )
        .limit(MAX_SCAN_LIMIT),
      db
        .select({ id: bottles.id })
        .from(bottles)
        .innerJoin(catalogTargets, activeExactBottleTargetJoin())
        .where(
          and(
            ilike(bottles.fullName, `%${query}%`),
            activeExactBottleConditions(),
          ),
        )
        .limit(MAX_SCAN_LIMIT),
      getQueryAliasMembership({ query }),
    ]);

  const bottleIds = new Set<number>();

  for (const { id } of matchingBottleRows) {
    bottleIds.add(id);
  }

  for (const row of matchingAliasRows) {
    bottleIds.add(row.bottleId);
  }

  const matchingBrandIds = matchingBrandRows.map(({ id }) => id);
  if (matchingBrandIds.length > 0) {
    const brandBottleRows = await db
      .select({ id: bottles.id })
      .from(bottles)
      .innerJoin(catalogTargets, activeExactBottleTargetJoin())
      .where(
        and(
          inArray(bottles.brandId, matchingBrandIds),
          activeExactBottleConditions(),
        ),
      )
      .limit(MAX_SCAN_LIMIT);

    for (const { id } of brandBottleRows) {
      bottleIds.add(id);
    }
  }

  if (bottleIds.size === 0) {
    return [];
  }

  return await db
    .select({
      brandId: bottles.brandId,
      fullName: bottles.fullName,
      id: bottles.id,
      name: bottles.name,
      numReleases: bottles.numReleases,
      totalTastings: bottles.totalTastings,
    })
    .from(bottles)
    .innerJoin(catalogTargets, activeExactBottleTargetJoin())
    .where(
      and(
        isNotNull(bottles.brandId),
        inArray(bottles.id, Array.from(bottleIds).slice(0, MAX_SCAN_LIMIT)),
        activeExactBottleConditions(),
      ),
    )
    .orderBy(desc(bottles.totalTastings), desc(bottles.id));
}

async function collectBrandRepairCandidates({
  currentBrandId,
  query = "",
  targetBrandId,
}: {
  currentBrandId?: number;
  query?: string;
  targetBrandId?: number;
}) {
  const trimmedQuery = query.trim();
  const normalizedQuery = normalizeComparableText(trimmedQuery);
  const candidateBottles = await getCandidateBottles({
    currentBrandId,
    query: trimmedQuery,
  });

  if (candidateBottles.length === 0) {
    return [] as BrandRepairCandidateInternal[];
  }

  const currentBrandIds = Array.from(
    new Set(
      candidateBottles
        .map((bottle) => bottle.brandId)
        .filter((brandId): brandId is number => brandId !== null),
    ),
  );
  const candidateBottleIds = candidateBottles.map((bottle) => bottle.id);

  if (currentBrandIds.length === 0) {
    return [] as BrandRepairCandidateInternal[];
  }

  const [currentBrands, aliasRows, brandRows] = await Promise.all([
    db.select().from(entities).where(inArray(entities.id, currentBrandIds)),
    getSupportingAliasMembership(candidateBottleIds),
    db
      .select({
        alias: entityAliases.name,
        brand: entities,
      })
      .from(entities)
      .leftJoin(entityAliases, eq(entityAliases.entityId, entities.id))
      .where(sql`'brand' = ANY(${entities.type})`),
  ]);

  const currentBrandsById = new Map(
    currentBrands.map((brand) => [brand.id, brand]),
  );
  const aliasesByBottleId = new Map<number, string[]>();
  for (const row of aliasRows) {
    aliasesByBottleId.set(row.bottleId, [
      ...(aliasesByBottleId.get(row.bottleId) ?? []),
      row.name,
    ]);
  }

  const allBrandsById = new Map<number, CandidateBrand>();
  const brandNameIndex = new Map<string, BrandNameEntry[]>();
  const brandNamesById = new Map<number, BrandNameEntry[]>();
  for (const { alias, brand } of brandRows) {
    allBrandsById.set(brand.id, brand);
    registerBrandName(brandNameIndex, brandNamesById, brand, brand.name);
    registerBrandName(brandNameIndex, brandNamesById, brand, brand.shortName);
    registerBrandName(brandNameIndex, brandNamesById, brand, alias);
  }

  const results: BrandRepairCandidateInternal[] = [];

  for (const bottle of candidateBottles) {
    if (bottle.brandId === null) {
      continue;
    }

    const currentBrand = currentBrandsById.get(bottle.brandId);
    if (!currentBrand) {
      continue;
    }

    if (currentBrandId && currentBrand.id !== currentBrandId) {
      continue;
    }

    const currentBrandNames = brandNamesById.get(currentBrand.id) ?? [];
    const supportingTexts = [
      {
        source: "full_name" as const,
        text: bottle.fullName,
      },
      ...(aliasesByBottleId.get(bottle.id) ?? []).map((text) => ({
        source: "alias" as const,
        text,
      })),
    ];

    const targetSupport = new Map<number, BrandRepairSupportingReference[]>();

    for (const reference of supportingTexts) {
      const leadingPhrases = getLeadingComparablePhrases(reference.text);
      if (leadingPhrases.length === 0) {
        continue;
      }

      const currentBrandMatch = getBestCurrentBrandMatch({
        brandNames: currentBrandNames,
        text: reference.text,
      });
      const currentBrandMatchedWordCount = currentBrandMatch?.wordCount ?? 0;

      const bestReferenceSupport = new Map<
        number,
        BrandRepairSupportingReference
      >();
      for (const phrase of [...leadingPhrases].reverse()) {
        for (const entry of brandNameIndex.get(phrase) ?? []) {
          if (entry.entityId === currentBrand.id) {
            continue;
          }

          if (
            entry.wordCount <= currentBrandMatchedWordCount &&
            !(
              reference.source === "alias" && currentBrandMatchedWordCount === 0
            )
          ) {
            continue;
          }

          if (
            entry.wordCount === 1 &&
            reference.source === "full_name" &&
            currentBrandMatchedWordCount === 0
          ) {
            continue;
          }

          const candidateSupport: BrandRepairSupportingReference = {
            currentBrandMatchedName: currentBrandMatch?.originalName ?? null,
            currentBrandMatchedWordCount,
            source: reference.source,
            targetMatchedName: entry.originalName,
            targetMatchedWordCount: entry.wordCount,
            text: reference.text,
          };

          const existingSupport = bestReferenceSupport.get(entry.entityId);
          if (
            existingSupport &&
            compareSupportingReferenceQuality(
              existingSupport,
              candidateSupport,
            ) <= 0
          ) {
            continue;
          }

          bestReferenceSupport.set(entry.entityId, candidateSupport);
        }
      }

      for (const [entityId, support] of bestReferenceSupport) {
        targetSupport.set(entityId, [
          ...(targetSupport.get(entityId) ?? []),
          support,
        ]);
      }
    }

    const targetCandidates: RankedTargetCandidate[] = [];
    const hasCanonicalCurrentBrandMatch =
      getBestCurrentBrandMatch({
        brandNames: currentBrandNames,
        text: bottle.fullName,
      }) !== null;

    for (const [entityId, supportingReferences] of targetSupport.entries()) {
      const targetBrand = allBrandsById.get(entityId);
      if (!targetBrand) {
        continue;
      }

      if (!hasDeterministicRepairScope({ currentBrand, targetBrand })) {
        continue;
      }

      if (isGenericProductBrandExpansion({ currentBrand, targetBrand })) {
        continue;
      }

      const sortedSupportingReferences = [...supportingReferences].sort(
        compareSupportingReferenceQuality,
      );
      const strongestSupport = sortedSupportingReferences[0];
      if (!strongestSupport) {
        continue;
      }

      if (
        !hasSafeAliasOnlyBrandRepairSupport({
          currentBrand,
          hasCanonicalCurrentBrandMatch,
          supportingReferences: sortedSupportingReferences,
          targetBrand,
        })
      ) {
        continue;
      }

      targetCandidates.push({
        currentBrand,
        sortStrength: [
          strongestSupport.targetMatchedWordCount,
          sortedSupportingReferences.length,
          bottle.totalTastings ?? 0,
          targetBrand.totalBottles,
        ],
        supportingReferences: sortedSupportingReferences,
        targetBrand,
      });
    }

    targetCandidates.sort((left, right) => {
      for (let index = 0; index < left.sortStrength.length; index += 1) {
        const diff = right.sortStrength[index]! - left.sortStrength[index]!;
        if (diff !== 0) {
          return diff;
        }
      }

      return right.targetBrand.id - left.targetBrand.id;
    });

    const bestTarget = targetCandidates[0];
    if (!bestTarget) {
      continue;
    }

    const candidate: BrandRepairCandidateInternal = {
      bottle: {
        fullName: bottle.fullName,
        id: bottle.id,
        name: bottle.name,
        numReleases: bottle.numReleases,
        totalTastings: bottle.totalTastings,
      },
      currentBrand: {
        id: currentBrand.id,
        name: currentBrand.name,
        shortName: currentBrand.shortName,
        totalBottles: currentBrand.totalBottles,
        totalTastings: currentBrand.totalTastings,
      },
      suggestedDistillery: currentBrand.type.includes("distiller")
        ? {
            id: currentBrand.id,
            name: currentBrand.name,
          }
        : null,
      sortStrength: bestTarget.sortStrength,
      supportingReferences: bestTarget.supportingReferences.slice(0, 3),
      targetBrand: {
        id: bestTarget.targetBrand.id,
        name: bestTarget.targetBrand.name,
        shortName: bestTarget.targetBrand.shortName,
        totalBottles: bestTarget.targetBrand.totalBottles,
        totalTastings: bestTarget.targetBrand.totalTastings,
      },
    };

    if (targetBrandId && candidate.targetBrand.id !== targetBrandId) {
      continue;
    }

    if (normalizedQuery && !candidateMatchesQuery(candidate, normalizedQuery)) {
      continue;
    }

    results.push(candidate);
  }

  results.sort(compareBrandRepairCandidate);
  return results;
}

export async function findBrandRepairCandidates({
  currentBrandId,
  query = "",
  targetBrandId,
}: {
  currentBrandId?: number;
  query?: string;
  targetBrandId?: number;
}) {
  const results = await collectBrandRepairCandidates({
    currentBrandId,
    query,
    targetBrandId,
  });

  return results.map(toPublicCandidate);
}

export async function getBrandRepairCandidates({
  cursor = 1,
  currentBrandId,
  limit = 25,
  query = "",
  targetBrandId,
}: {
  cursor?: number;
  currentBrandId?: number;
  limit?: number;
  query?: string;
  targetBrandId?: number;
}) {
  const results = await collectBrandRepairCandidates({
    currentBrandId,
    query,
    targetBrandId,
  });

  const start = (cursor - 1) * limit;
  const pagedResults = results.slice(start, start + limit);
  const nextCursor = start + limit < results.length ? cursor + 1 : null;
  const prevCursor = cursor > 1 ? cursor - 1 : null;

  return {
    results: pagedResults.map(toPublicCandidate),
    rel: {
      nextCursor,
      prevCursor,
    },
  };
}

export async function getBrandRepairGroups({
  cursor = 1,
  currentBrandId,
  limit = 25,
  query = "",
  targetBrandId,
}: {
  cursor?: number;
  currentBrandId?: number;
  limit?: number;
  query?: string;
  targetBrandId?: number;
}) {
  const candidates = await collectBrandRepairCandidates({
    currentBrandId,
    query,
    targetBrandId,
  });

  const groupsByKey = new Map<
    string,
    {
      candidates: BrandRepairCandidateInternal[];
      currentBrand: BrandRepairCandidate["currentBrand"];
      suggestedDistillery: BrandRepairCandidate["suggestedDistillery"];
      targetBrand: BrandRepairCandidate["targetBrand"];
      totalTastings: number;
    }
  >();

  for (const candidate of candidates) {
    const key = [
      candidate.currentBrand.id,
      candidate.targetBrand.id,
      candidate.suggestedDistillery?.id ?? "none",
    ].join(":");
    const currentGroup = groupsByKey.get(key);

    if (!currentGroup) {
      groupsByKey.set(key, {
        candidates: [candidate],
        currentBrand: candidate.currentBrand,
        suggestedDistillery: candidate.suggestedDistillery,
        targetBrand: candidate.targetBrand,
        totalTastings: candidate.bottle.totalTastings ?? 0,
      });
      continue;
    }

    currentGroup.candidates.push(candidate);
    currentGroup.totalTastings += candidate.bottle.totalTastings ?? 0;
  }

  const groups = Array.from(groupsByKey.values())
    .map(
      (group): BrandRepairGroup => ({
        candidateCount: group.candidates.length,
        currentBrand: group.currentBrand,
        sampleBottles: group.candidates.slice(0, 3).map((candidate) => ({
          bottle: candidate.bottle,
          supportingReferences: candidate.supportingReferences,
        })),
        suggestedDistillery: group.suggestedDistillery,
        targetBrand: group.targetBrand,
        totalTastings: group.totalTastings,
      }),
    )
    .sort((left, right) => {
      if (right.candidateCount !== left.candidateCount) {
        return right.candidateCount - left.candidateCount;
      }

      if (right.totalTastings !== left.totalTastings) {
        return right.totalTastings - left.totalTastings;
      }

      if (right.targetBrand.totalBottles !== left.targetBrand.totalBottles) {
        return right.targetBrand.totalBottles - left.targetBrand.totalBottles;
      }

      return right.targetBrand.id - left.targetBrand.id;
    });

  const start = (cursor - 1) * limit;
  const pagedResults = groups.slice(start, start + limit);
  const nextCursor = start + limit < groups.length ? cursor + 1 : null;
  const prevCursor = cursor > 1 ? cursor - 1 : null;

  return {
    results: pagedResults,
    rel: {
      nextCursor,
      prevCursor,
    },
  };
}
