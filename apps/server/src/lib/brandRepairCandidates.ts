import { normalizeString } from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  entities,
  entityAliases,
} from "@peated/server/db/schema";
import { and, desc, eq, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";

const MAX_PREFIX_WORDS = 8;
const MAX_SCAN_LIMIT = 2000;

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
        .where(eq(bottles.brandId, currentBrandId))
        .orderBy(desc(bottles.totalTastings), desc(bottles.id))
        .limit(MAX_SCAN_LIMIT);
    }

    const [matchingBottleRows, matchingAliasRows] = await Promise.all([
      db
        .select({ id: bottles.id })
        .from(bottles)
        .where(
          and(
            eq(bottles.brandId, currentBrandId),
            ilike(bottles.fullName, `%${query}%`),
          ),
        )
        .limit(MAX_SCAN_LIMIT),
      db
        .select({ bottleId: bottleAliases.bottleId })
        .from(bottleAliases)
        .innerJoin(bottles, eq(bottles.id, bottleAliases.bottleId))
        .where(
          and(
            eq(bottles.brandId, currentBrandId),
            eq(bottleAliases.ignored, false),
            isNotNull(bottleAliases.bottleId),
            ilike(bottleAliases.name, `%${query}%`),
          ),
        )
        .limit(MAX_SCAN_LIMIT),
    ]);

    const bottleIds = new Set<number>();
    for (const { id } of matchingBottleRows) {
      bottleIds.add(id);
    }

    for (const row of matchingAliasRows) {
      if (row.bottleId !== null) {
        bottleIds.add(row.bottleId);
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
      .where(
        and(
          eq(bottles.brandId, currentBrandId),
          inArray(bottles.id, Array.from(bottleIds).slice(0, MAX_SCAN_LIMIT)),
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
      .where(isNotNull(bottles.brandId))
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
        .where(ilike(bottles.fullName, `%${query}%`))
        .limit(MAX_SCAN_LIMIT),
      db
        .select({ bottleId: bottleAliases.bottleId })
        .from(bottleAliases)
        .where(
          and(
            eq(bottleAliases.ignored, false),
            isNotNull(bottleAliases.bottleId),
            ilike(bottleAliases.name, `%${query}%`),
          ),
        )
        .limit(MAX_SCAN_LIMIT),
    ]);

  const bottleIds = new Set<number>();

  for (const { id } of matchingBottleRows) {
    bottleIds.add(id);
  }

  for (const row of matchingAliasRows) {
    if (row.bottleId !== null) {
      bottleIds.add(row.bottleId);
    }
  }

  const matchingBrandIds = matchingBrandRows.map(({ id }) => id);
  if (matchingBrandIds.length > 0) {
    const brandBottleRows = await db
      .select({ id: bottles.id })
      .from(bottles)
      .where(inArray(bottles.brandId, matchingBrandIds))
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
    .where(
      and(
        isNotNull(bottles.brandId),
        inArray(bottles.id, Array.from(bottleIds).slice(0, MAX_SCAN_LIMIT)),
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
    db
      .select({
        bottleId: bottleAliases.bottleId,
        name: bottleAliases.name,
      })
      .from(bottleAliases)
      .where(
        and(
          eq(bottleAliases.ignored, false),
          isNotNull(bottleAliases.bottleId),
          inArray(bottleAliases.bottleId, candidateBottleIds),
        ),
      ),
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
    if (row.bottleId === null) {
      continue;
    }

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
    for (const [entityId, supportingReferences] of targetSupport.entries()) {
      const targetBrand = allBrandsById.get(entityId);
      if (!targetBrand) {
        continue;
      }

      const sortedSupportingReferences = [...supportingReferences].sort(
        compareSupportingReferenceQuality,
      );
      const strongestSupport = sortedSupportingReferences[0];
      if (!strongestSupport) {
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
