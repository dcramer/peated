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
import {
  buildBottleCandidateFromCatalog,
  buildReleaseCandidateFromCatalog,
} from "./candidates";
import {
  LocalCatalogSchema,
  type LocalCatalog,
  type LocalCatalogBottle,
  type LocalCatalogRelease,
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

function getReleaseFullName({
  catalog,
  bottle,
  release,
}: {
  catalog: LocalCatalog;
  bottle: LocalCatalogBottle;
  release: LocalCatalogRelease;
}) {
  return (
    release.fullName ??
    [getBottleFullName(catalog, bottle), release.edition]
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
      (alias) =>
        !alias.ignored &&
        alias.bottleId === candidate.bottleId &&
        (candidate.releaseId === null
          ? alias.releaseId === null
          : alias.releaseId === candidate.releaseId),
    )?.name ?? null
  );
}

function candidateKey(candidate: BottleCandidate) {
  return candidate.releaseId === null
    ? `bottle:${candidate.bottleId}`
    : `release:${candidate.releaseId}`;
}

function mergeCandidates(candidates: BottleCandidate[]) {
  const byKey = new Map<string, BottleCandidate>();

  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, candidate);
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
    candidate.bottleFullName,
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

  if (
    args.currentBottleId !== null &&
    candidate.bottleId === args.currentBottleId
  ) {
    score += 0.25;
  }
  if (
    args.currentReleaseId !== null &&
    candidate.releaseId === args.currentReleaseId
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

function buildReleaseCandidate({
  catalog,
  bottle,
  release,
  alias = null,
  score,
  source,
}: {
  catalog: LocalCatalog;
  bottle: LocalCatalogBottle;
  release: LocalCatalogRelease;
  alias?: string | null;
  score: number;
  source: Array<"exact" | "text" | "brand" | "vector" | "current">;
}) {
  return buildReleaseCandidateFromCatalog({
    catalog,
    bottle,
    release,
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

  for (const release of catalog.releases) {
    const bottle = catalog.bottles.find(
      (entry) => entry.id === release.bottleId,
    );
    if (!bottle) {
      continue;
    }
    const candidate = buildReleaseCandidate({
      catalog,
      bottle,
      release,
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

    if (alias.releaseId !== null) {
      const release = catalog.releases.find(
        (entry) => entry.id === alias.releaseId,
      );
      if (!release) {
        continue;
      }
      candidates.push(
        buildReleaseCandidate({
          catalog,
          bottle,
          release,
          alias: alias.name,
          score: 1,
          source: ["exact"],
        }),
      );
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
  releaseId,
}: {
  catalog: LocalCatalog;
  bottleId: number;
  releaseId: number | null;
}) {
  const bottle = catalog.bottles.find((entry) => entry.id === bottleId);
  if (!bottle) {
    return null;
  }

  if (releaseId !== null) {
    const release = catalog.releases.find(
      (entry) => entry.id === releaseId && entry.bottleId === bottleId,
    );
    if (!release) {
      return null;
    }
    return buildReleaseCandidate({
      catalog,
      bottle,
      release,
      score: 1,
      source: ["current"],
    });
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
    .filter((entity) => {
      if (args.type !== null && !entity.type.includes(args.type)) {
        return false;
      }

      const normalizedName = normalizeSearchText(entity.name);
      const normalizedShortName = normalizeSearchText(entity.shortName);
      return (
        normalizedName.includes(normalizedQuery) ||
        normalizedShortName.includes(normalizedQuery) ||
        (normalizedName.length >= 4 &&
          normalizedQuery.includes(normalizedName)) ||
        (normalizedShortName.length >= 4 &&
          normalizedQuery.includes(normalizedShortName))
      );
    })
    .map((entity) => {
      const normalizedName = normalizeSearchText(entity.name);
      const normalizedShortName = normalizeSearchText(entity.shortName);
      const score =
        normalizedName === normalizedQuery ||
        normalizedShortName === normalizedQuery
          ? 1
          : normalizedName.includes(normalizedQuery) ||
              normalizedShortName.includes(normalizedQuery)
            ? 0.8
            : Math.max(
                containedEntityScore(normalizedQuery, normalizedName),
                containedEntityScore(normalizedQuery, normalizedShortName),
              );
      const matchSource =
        normalizedName === normalizedQuery ||
        normalizedShortName === normalizedQuery
          ? "exact"
          : normalizedName.includes(normalizedQuery) ||
              normalizedShortName.includes(normalizedQuery)
            ? "text"
            : "contained";

      return EntityResolutionSchema.parse({
        entityId: entity.id,
        name: entity.name,
        shortName: entity.shortName,
        type: entity.type,
        alias: null,
        score,
        source: ["local_catalog", matchSource],
      });
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
    getBottleCandidateById: async (bottleId, releaseId) =>
      getCatalogCandidateById({ catalog, bottleId, releaseId }),
    searchEntities: async (args) => searchCatalogEntities(catalog, args),
  };
}
