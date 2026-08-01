import type { BottleClassifierDataSource } from "../classifierRuntime";
import {
  BottleCandidateSearchInputSchema,
  EntityResolutionSchema,
  type BottleCandidate,
  type BottleCandidateSearchInput,
  type BottleExtractedDetails,
  type EntityResolution,
  type SearchEntitiesArgs,
} from "../classifierTypes";
import type { BottleReference } from "../contract";
import { buildDefaultBottleSearchInput } from "../runtime/agentInput";
import { buildBottleCandidateFromCatalog } from "./candidates";
import {
  LocalCatalogSchema,
  type LocalCatalog,
  type LocalCatalogBottle,
} from "./schema";

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0 && token !== "the")
    .join(" ");
}

function includesSearchText(
  haystack: string | null | undefined,
  needle: string | null | undefined,
) {
  const normalizedNeedle = normalizeSearchText(needle);
  if (!normalizedNeedle) {
    return false;
  }

  return normalizeSearchText(haystack).includes(normalizedNeedle);
}

function containedEntityScore(query: string, candidate: string) {
  if (!candidate || !query.includes(candidate)) {
    return 0.25;
  }

  return 0.25 + 0.2 * (candidate.length / query.length);
}

function getEntitySearchMatch({
  query,
  name,
  shortName,
  aliases,
}: {
  query: string;
  name: string | null | undefined;
  shortName: string | null | undefined;
  aliases: string[];
}) {
  const candidates = [
    { value: name, alias: null },
    { value: shortName, alias: null },
    ...aliases.map((alias) => ({ value: alias, alias })),
  ];
  let bestMatch:
    | {
        alias: string | null;
        score: number;
        source: "exact" | "text" | "contained";
      }
    | undefined;

  for (const { value, alias } of candidates) {
    const normalizedValue = normalizeSearchText(value);
    const match =
      normalizedValue === query
        ? { alias, score: 1, source: "exact" as const }
        : normalizedValue.includes(query)
          ? { alias, score: 0.8, source: "text" as const }
          : normalizedValue.length >= 4 && query.includes(normalizedValue)
            ? {
                alias,
                score: containedEntityScore(query, normalizedValue),
                source: "contained" as const,
              }
            : undefined;
    if (match && (!bestMatch || match.score > bestMatch.score)) {
      bestMatch = match;
    }
  }

  return bestMatch;
}

function getEntity(catalog: LocalCatalog, id: number | null | undefined) {
  return id == null
    ? null
    : (catalog.entities.find((entity) => entity.id === id) ?? null);
}

function getBottleFullName(catalog: LocalCatalog, bottle: LocalCatalogBottle) {
  return (
    bottle.fullName ??
    [getEntity(catalog, bottle.brandId)?.name, bottle.name]
      .filter(Boolean)
      .join(" ")
      .trim()
  );
}

function getAliasForCandidate(
  catalog: LocalCatalog,
  candidate: BottleCandidate,
) {
  return (
    catalog.aliases.find(
      (alias) => !alias.ignored && alias.bottleId === candidate.bottleId,
    )?.name ?? null
  );
}

function mergeCandidates(candidates: BottleCandidate[]) {
  const byKey = new Map<number, BottleCandidate>();

  for (const candidate of candidates) {
    const existing = byKey.get(candidate.bottleId);
    if (!existing) {
      byKey.set(candidate.bottleId, candidate);
      continue;
    }

    existing.source = Array.from(
      new Set([...existing.source, ...candidate.source]),
    );
    if (
      candidate.score !== null &&
      (existing.score === null || candidate.score > existing.score)
    ) {
      existing.score = candidate.score;
    }
    if (!existing.alias && candidate.alias) {
      existing.alias = candidate.alias;
    }
  }

  return Array.from(byKey.values()).sort((left, right) => {
    const scoreDelta = (right.score ?? 0) - (left.score ?? 0);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return left.fullName.localeCompare(right.fullName);
  });
}

function scoreCandidate({
  args,
  candidate,
}: {
  args: BottleCandidateSearchInput;
  candidate: BottleCandidate;
}) {
  let score = 0;
  const searchableText = [
    candidate.alias,
    candidate.fullName,
    candidate.brand,
    candidate.series,
    candidate.edition,
  ].join(" ");

  if (
    args.query &&
    (normalizeSearchText(candidate.fullName) ===
      normalizeSearchText(args.query) ||
      normalizeSearchText(candidate.alias) === normalizeSearchText(args.query))
  ) {
    score += 1;
  } else if (includesSearchText(searchableText, args.query)) {
    score += 0.45;
  }

  if (
    args.brand &&
    (normalizeSearchText(candidate.brand) === normalizeSearchText(args.brand) ||
      includesSearchText(candidate.fullName, args.brand))
  ) {
    score += 0.4;
  }

  if (args.expression && includesSearchText(searchableText, args.expression)) {
    score += 0.35;
  }

  if (args.series && includesSearchText(candidate.series, args.series)) {
    score += 0.2;
  }

  if (args.stated_age !== null && candidate.statedAge === args.stated_age) {
    score += 0.15;
  }

  if (args.category !== null && candidate.category === args.category) {
    score += 0.1;
  }

  const exactTraitPairs = [
    [args.edition, candidate.edition],
    [args.abv, candidate.abv],
    [args.cask_strength, candidate.caskStrength],
    [args.single_cask, candidate.singleCask],
    [args.cask_type, candidate.caskType],
    [args.cask_size, candidate.caskSize],
    [args.cask_fill, candidate.caskFill],
    [args.vintage_year, candidate.vintageYear],
    [args.release_year, candidate.releaseYear],
  ] as const;
  for (const [expected, actual] of exactTraitPairs) {
    if (expected !== null && expected === actual) {
      score += 0.1;
    }
  }

  if (
    args.currentBottleId !== null &&
    candidate.bottleId === args.currentBottleId
  ) {
    score += 0.25;
  }
  return score;
}

function buildBottleCandidate({
  catalog,
  bottle,
  alias = null,
  score,
  source,
}: {
  catalog: LocalCatalog;
  bottle: LocalCatalogBottle;
  alias?: string | null;
  score: number;
  source: Array<"exact" | "text" | "brand" | "vector" | "current">;
}) {
  return buildBottleCandidateFromCatalog({
    catalog,
    bottle,
    alias,
    score,
    source,
  });
}

function buildAllCandidates(catalog: LocalCatalog) {
  const candidates: BottleCandidate[] = [];

  for (const bottle of catalog.bottles) {
    const candidate = buildBottleCandidate({
      catalog,
      bottle,
      alias: null,
      score: 0,
      source: ["vector"],
    });
    candidates.push({
      ...candidate,
      alias: getAliasForCandidate(catalog, candidate),
    });
  }

  return candidates;
}

function findExactAliasCandidates({
  catalog,
  query,
}: {
  catalog: LocalCatalog;
  query: string | null | undefined;
}) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return [];
  }

  const candidates: BottleCandidate[] = [];
  for (const alias of catalog.aliases.filter((entry) => !entry.ignored)) {
    if (normalizeSearchText(alias.name) !== normalizedQuery) {
      continue;
    }

    const bottle = catalog.bottles.find((entry) => entry.id === alias.bottleId);
    if (!bottle) {
      continue;
    }

    candidates.push(
      buildBottleCandidate({
        catalog,
        bottle,
        alias: alias.name,
        score: 1,
        source: ["exact"],
      }),
    );
  }

  return candidates;
}

function searchCatalogCandidates(
  catalog: LocalCatalog,
  rawArgs: BottleCandidateSearchInput,
) {
  const args = BottleCandidateSearchInputSchema.parse(rawArgs);
  const exactCandidates = findExactAliasCandidates({
    catalog,
    query: args.query,
  });
  const scoredCandidates = buildAllCandidates(catalog).flatMap((candidate) => {
    const score = scoreCandidate({ args, candidate });
    if (score <= 0) {
      return [];
    }

    const source = new Set(candidate.source);
    if (args.brand && candidate.brand === args.brand) {
      source.add("brand");
    }
    if (args.query || args.expression) {
      source.add("text");
    }

    return [
      {
        ...candidate,
        score,
        source: Array.from(source),
      },
    ];
  });

  return mergeCandidates([...exactCandidates, ...scoredCandidates]).slice(
    0,
    args.limit,
  );
}

function getCatalogCandidateById({
  catalog,
  bottleId,
}: {
  catalog: LocalCatalog;
  bottleId: number;
}) {
  const bottle = catalog.bottles.find((entry) => entry.id === bottleId);
  if (!bottle) {
    return null;
  }

  return buildBottleCandidate({
    catalog,
    bottle,
    score: 1,
    source: ["current"],
  });
}

function searchCatalogEntities(
  catalog: LocalCatalog,
  args: SearchEntitiesArgs,
): EntityResolution[] {
  const normalizedQuery = normalizeSearchText(args.query);

  return catalog.entities
    .flatMap((entity) => {
      if (args.type !== null && !entity.type.includes(args.type)) {
        return [];
      }

      const match = getEntitySearchMatch({
        query: normalizedQuery,
        name: entity.name,
        shortName: entity.shortName,
        aliases: entity.aliases,
      });
      if (!match) {
        return [];
      }

      return [
        EntityResolutionSchema.parse({
          entityId: entity.id,
          name: entity.name,
          shortName: entity.shortName,
          type: entity.type,
          alias: match.alias,
          score: match.score,
          source: ["local_catalog", match.source],
        }),
      ];
    })
    .sort((left, right) => {
      const scoreDelta = (right.score ?? 0) - (left.score ?? 0);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, args.limit);
}

/**
 * Builds an in-memory classifier data source from typed fixture catalog data.
 * It models classifier-relevant retrieval, not production SQL/search parity.
 */
export function createLocalCatalogDataSource(
  rawCatalog: LocalCatalog,
): BottleClassifierDataSource {
  const catalog = LocalCatalogSchema.parse(rawCatalog);

  return {
    findInitialCandidates: async ({
      reference,
      extractedIdentity,
    }: {
      reference: BottleReference;
      extractedIdentity: BottleExtractedDetails | null;
    }) =>
      searchCatalogCandidates(
        catalog,
        buildDefaultBottleSearchInput({ reference, extractedIdentity }),
      ),
    searchBottles: async (args) => searchCatalogCandidates(catalog, args),
    getBottleCandidateById: async (bottleId) =>
      getCatalogCandidateById({ catalog, bottleId }),
    searchEntities: async (args) => searchCatalogEntities(catalog, args),
  };
}
