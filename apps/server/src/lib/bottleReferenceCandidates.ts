import {
  BOTTLE_DECISION_TRAIT_FIELDS,
  BottleCandidateSchema,
  BottleCandidateSearchInputSchema,
  BottleExtractedDetailsSchema,
  mergeBottleCandidateFamilyContext,
  type BottleCandidate,
  type BottleCandidateSearchInput,
  type BottleExtractedDetails,
} from "@peated/bottle-classifier/internal/types";
import {
  normalizeBottle,
  normalizeBottleBatchNumber,
  normalizeString,
} from "@peated/bottle-classifier/normalize";
import { parseReferenceName as parseSmwsReferenceName } from "@peated/bottle-classifier/smws";
import { db, type AnyDatabase } from "@peated/server/db";
import {
  bottleAliases,
  bottleSeries,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  entities,
} from "@peated/server/db/schema";
import {
  normalizePotentialProofLikeAbvFields,
  normalizePotentialProofToAbv,
} from "@peated/server/lib/abv";
import { logError } from "@peated/server/lib/log";
import {
  isAIGatewayConfigured,
  type AIGatewayWorkload,
} from "@peated/server/lib/openaiClient";
import { webSearchQuery } from "@peated/server/lib/search";
import { and, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { z } from "zod";
import { getOpenAIEmbedding } from "./openaiEmbeddings";

const VECTOR_CANDIDATE_LIMIT = 20;
const TEXT_CANDIDATE_LIMIT = 10;
const BRAND_CANDIDATE_LIMIT = 5;

type BottleReferenceIdentity = BottleExtractedDetails;
type RawBottleCandidateRow = {
  bottleId: number | string;
  alias?: string | null;
  fullName: string;
  brand?: string | null;
  bottler?: string | null;
  series?: string | null;
  distillery?: string[] | null;
  category?: BottleCandidate["category"];
  statedAge?: number | string | null;
  edition?: string | null;
  caskStrength?: boolean | null;
  singleCask?: boolean | null;
  abv?: number | string | null;
  vintageYear?: number | string | null;
  releaseYear?: number | string | null;
  caskType?: string | null;
  caskSize?: string | null;
  caskFill?: string | null;
  score?: number | string | null;
};

function normalizeMatchCategory<T extends BottleCandidate["category"]>(
  category: T,
) {
  return category === "spirit" ? null : category;
}

type BottleCandidateSearchInputRequest = z.input<
  typeof BottleCandidateSearchInputSchema
>;
type BottleCandidateFamilyContext = NonNullable<
  BottleCandidate["familyContext"]
>;
type BottleCandidateTraitField =
  BottleCandidateFamilyContext["siblingBottles"][number]["traitFields"][number];

const CANDIDATE_METADATA_FIELDS = [
  "bottler",
  "series",
  "category",
  "statedAge",
  "edition",
  "caskStrength",
  "singleCask",
  "abv",
  "vintageYear",
  "releaseYear",
  "caskType",
  "caskSize",
  "caskFill",
] as const satisfies ReadonlyArray<keyof BottleCandidate>;

const CANDIDATE_SIBLING_LIMIT = 8;

function getNormalizedPriceName(name: string) {
  return normalizeBottle({
    name,
    isFullName: true,
  }).name;
}

function formatSearchAbv(abv: number | null | undefined) {
  if (abv === null || abv === undefined) {
    return null;
  }

  return `${abv.toFixed(1)}% ABV`;
}

function buildSearchLabel(
  input: BottleCandidateSearchInput,
): BottleReferenceIdentity | null {
  if (
    !input.brand &&
    !input.bottler &&
    !input.expression &&
    !input.series &&
    !input.distillery.length &&
    !input.category &&
    !input.stated_age &&
    input.abv === null &&
    input.cask_strength === null &&
    input.single_cask === null &&
    !input.edition &&
    !input.vintage_year &&
    !input.release_year
  ) {
    return null;
  }

  return BottleExtractedDetailsSchema.parse({
    brand: input.brand,
    bottler: input.bottler,
    expression: input.expression,
    series: input.series,
    distillery: input.distillery,
    category: normalizeMatchCategory(input.category),
    stated_age: input.stated_age,
    abv: input.abv,
    release_year: input.release_year,
    vintage_year: input.vintage_year,
    cask_type: input.cask_type,
    cask_size: input.cask_size,
    cask_fill: input.cask_fill,
    cask_strength: input.cask_strength,
    single_cask: input.single_cask,
    edition: input.edition,
  });
}

function buildRawSearchName(input: BottleCandidateSearchInput) {
  const structuredParts = [
    input.brand,
    input.bottler,
    input.expression,
    input.series,
    input.edition,
    input.stated_age ? `${input.stated_age}` : null,
    formatSearchAbv(input.abv),
    input.cask_strength ? "cask strength" : null,
    input.single_cask ? "single cask" : null,
    input.vintage_year ? `${input.vintage_year} vintage` : null,
    input.release_year ? `${input.release_year} release` : null,
    input.distillery.length ? input.distillery.join(" ") : null,
  ];

  const structuredName = structuredParts.filter(Boolean).join(" ").trim();
  const hasStrongStructuredIdentity = Boolean(
    input.expression ||
    input.series ||
    input.edition ||
    input.stated_age ||
    input.vintage_year ||
    input.release_year ||
    input.distillery.length,
  );
  const hasStructuredIdentity = Boolean(
    hasStrongStructuredIdentity ||
    input.abv !== null ||
    input.cask_strength !== null ||
    input.single_cask !== null,
  );

  if (structuredName && hasStrongStructuredIdentity) {
    return structuredName;
  }

  return [input.query, hasStructuredIdentity ? structuredName : null]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function getSmwsExtractedLabelCode(
  extractedLabel: BottleReferenceIdentity | null,
): string | null {
  if (!extractedLabel) {
    return null;
  }

  const identityAnchors = [extractedLabel.brand, extractedLabel.bottler].filter(
    Boolean,
  );
  const codeFields = [extractedLabel.edition, extractedLabel.expression].filter(
    Boolean,
  );

  for (const identityAnchor of identityAnchors) {
    for (const codeField of codeFields) {
      const code = parseSmwsReferenceName(
        `${identityAnchor} ${codeField}`,
      )?.code;
      if (code) {
        return code;
      }
    }
  }

  return null;
}

export function mergeBottleCandidate(
  candidates: Map<number, BottleCandidate>,
  candidate: BottleCandidate,
) {
  const key = candidate.bottleId;
  const existing = candidates.get(key);
  if (!existing) {
    candidates.set(key, candidate);
    return;
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

  if (!existing.series && candidate.series) {
    existing.series = candidate.series;
  }

  if (!existing.bottler && candidate.bottler) {
    existing.bottler = candidate.bottler;
  }

  existing.familyContext = mergeBottleCandidateFamilyContext(
    existing.familyContext,
    candidate.familyContext,
  );

  if (!existing.distillery.length && candidate.distillery.length) {
    existing.distillery = candidate.distillery;
  } else if (candidate.distillery.length) {
    existing.distillery = Array.from(
      new Set([...existing.distillery, ...candidate.distillery]),
    );
  }

  const existingMetadata = existing as Record<
    (typeof CANDIDATE_METADATA_FIELDS)[number],
    BottleCandidate[(typeof CANDIDATE_METADATA_FIELDS)[number]]
  >;

  for (const field of CANDIDATE_METADATA_FIELDS) {
    const existingValue = existingMetadata[field];
    const candidateValue = candidate[field];

    if (existingValue === null && candidateValue !== null) {
      existingMetadata[field] = candidateValue;
    }
  }
}

function parseNullableNumber(value: number | string | null | undefined) {
  if (value === undefined || value === null) {
    return null;
  }

  return Number(value);
}

function buildBottleCandidate(
  row: RawBottleCandidateRow,
  source: string,
): BottleCandidate {
  return BottleCandidateSchema.parse({
    bottleId: Number(row.bottleId),
    alias: row.alias ?? null,
    fullName: row.fullName,
    brand: row.brand ?? null,
    bottler: row.bottler ?? null,
    series: row.series ?? null,
    distillery: row.distillery ?? [],
    category: row.category ?? null,
    statedAge: parseNullableNumber(row.statedAge),
    edition: row.edition ?? null,
    caskStrength: row.caskStrength ?? null,
    singleCask: row.singleCask ?? null,
    abv: normalizePotentialProofToAbv(parseNullableNumber(row.abv)),
    vintageYear: parseNullableNumber(row.vintageYear),
    releaseYear: parseNullableNumber(row.releaseYear),
    caskType: row.caskType ?? null,
    caskSize: row.caskSize ?? null,
    caskFill: row.caskFill ?? null,
    score:
      row.score === undefined || row.score === null ? null : Number(row.score),
    source: [source],
  });
}

function buildQueryText(
  normalizedName: string,
  extractedLabel: BottleReferenceIdentity | null,
) {
  const parts = [normalizedName];

  if (extractedLabel?.brand) parts.push(extractedLabel.brand);
  if (extractedLabel?.bottler) parts.push(extractedLabel.bottler);
  if (extractedLabel?.expression) parts.push(extractedLabel.expression);
  if (extractedLabel?.series) parts.push(extractedLabel.series);
  if (extractedLabel?.edition) parts.push(extractedLabel.edition);
  if (extractedLabel?.category) parts.push(extractedLabel.category);
  if (extractedLabel?.stated_age)
    parts.push(`${extractedLabel.stated_age}-year-old`);
  if (extractedLabel?.abv !== null && extractedLabel?.abv !== undefined)
    parts.push(formatSearchAbv(extractedLabel.abv)!);
  if (extractedLabel?.cask_strength) parts.push("cask strength");
  if (extractedLabel?.single_cask) parts.push("single cask");
  if (extractedLabel?.vintage_year)
    parts.push(`${extractedLabel.vintage_year} vintage`);
  if (extractedLabel?.release_year)
    parts.push(`${extractedLabel.release_year} release`);
  if (extractedLabel?.distillery?.length)
    parts.push(extractedLabel.distillery.join(" "));

  return Array.from(new Set(parts.filter(Boolean))).join(" ");
}

function buildExactSearchNameVariants(normalizedName: string) {
  const variants = [normalizedName];
  const batchSuffixMatch = normalizedName.match(/\s+\((batch [^)]+)\)\s*$/i);

  if (batchSuffixMatch?.[1]) {
    variants.push(
      normalizedName.replace(
        /\s+\((batch [^)]+)\)\s*$/i,
        ` ${batchSuffixMatch[1]}`,
      ),
    );
  }

  return variants;
}

function buildExactSearchNames(
  normalizedNames: Array<null | string | undefined>,
) {
  return Array.from(
    new Set(
      normalizedNames
        .filter((value): value is string => Boolean(value))
        .flatMap((value) => buildExactSearchNameVariants(value))
        .map((value) => value.toLowerCase()),
    ),
  );
}

function normalizeIdentityText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return normalizeString(value).toLowerCase().trim();
}

function normalizeComparableText(value: string | null | undefined) {
  return normalizeIdentityText(value)
    .replace(/'/g, "")
    .replace(/_/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getExactCaskCodeSqlPattern(code: string) {
  return `(^|[^A-Z0-9])${escapeRegExp(code)}([^A-Z0-9]|$)`;
}

function containsComparablePhrase(haystack: string, needle: string) {
  if (!haystack || !needle) {
    return false;
  }

  const pattern = new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(needle)}($|[^a-z0-9])`,
  );

  return pattern.test(haystack);
}

function textsOverlap(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return (
    normalizedLeft === normalizedRight ||
    containsComparablePhrase(normalizedLeft, normalizedRight) ||
    containsComparablePhrase(normalizedRight, normalizedLeft)
  );
}

function listMatchesExpectedValue(values: string[], expectedValues: string[]) {
  if (!values.length || !expectedValues.length) {
    return false;
  }

  return expectedValues.every((expectedValue) =>
    values.some((value) => textsOverlap(value, expectedValue)),
  );
}

function getStructuredCandidateAdjustment(
  candidate: BottleCandidate,
  extractedLabel: BottleReferenceIdentity | null,
) {
  if (!extractedLabel) {
    return 0;
  }

  let adjustment = 0;

  if (extractedLabel.brand && candidate.brand) {
    adjustment += textsOverlap(candidate.brand, extractedLabel.brand)
      ? 0.06
      : -0.1;
  }

  if (extractedLabel.bottler && candidate.bottler) {
    adjustment += textsOverlap(candidate.bottler, extractedLabel.bottler)
      ? 0.08
      : -0.14;
  }

  if (extractedLabel.series && candidate.series) {
    adjustment += textsOverlap(candidate.series, extractedLabel.series)
      ? 0.08
      : -0.14;
  }

  if (extractedLabel.distillery?.length && candidate.distillery.length) {
    adjustment += listMatchesExpectedValue(
      candidate.distillery,
      extractedLabel.distillery,
    )
      ? 0.1
      : -0.16;
  }

  if (extractedLabel.category && candidate.category) {
    adjustment +=
      candidate.category === normalizeMatchCategory(extractedLabel.category)
        ? 0.03
        : -0.06;
  }

  if (extractedLabel.stated_age !== null && candidate.statedAge !== null) {
    adjustment +=
      candidate.statedAge === extractedLabel.stated_age ? 0.1 : -0.18;
  }

  if (extractedLabel.edition && candidate.edition) {
    adjustment += textsOverlap(candidate.edition, extractedLabel.edition)
      ? 0.12
      : -0.2;
  }

  if (
    extractedLabel.cask_strength !== null &&
    candidate.caskStrength !== null
  ) {
    adjustment +=
      candidate.caskStrength === extractedLabel.cask_strength ? 0.06 : -0.12;
  }

  if (extractedLabel.single_cask !== null && candidate.singleCask !== null) {
    adjustment +=
      candidate.singleCask === extractedLabel.single_cask ? 0.06 : -0.12;
  }

  if (extractedLabel.vintage_year !== null && candidate.vintageYear !== null) {
    adjustment +=
      candidate.vintageYear === extractedLabel.vintage_year ? 0.08 : -0.14;
  }

  if (extractedLabel.release_year !== null && candidate.releaseYear !== null) {
    adjustment +=
      candidate.releaseYear === extractedLabel.release_year ? 0.08 : -0.14;
  }

  if (extractedLabel.abv !== null && candidate.abv !== null) {
    const difference = Math.abs(candidate.abv - extractedLabel.abv);
    if (difference <= 0.3) {
      adjustment += 0.05;
    } else if (difference >= 1.0) {
      adjustment -= 0.08;
    }
  }

  return adjustment;
}

function getCandidateSortScore(
  candidate: BottleCandidate,
  extractedLabel: BottleReferenceIdentity | null,
) {
  return (
    (candidate.score ?? 0) +
    getStructuredCandidateAdjustment(candidate, extractedLabel) +
    getExtractedBrandRankingAdjustment(candidate, extractedLabel)
  );
}

function candidateMatchesKnownBrand(
  candidate: BottleCandidate,
  brandName: string,
) {
  const normalizedBrand = normalizeIdentityText(brandName);
  if (!normalizedBrand) {
    return false;
  }

  return [candidate.brand, candidate.fullName, candidate.alias].some((value) =>
    normalizeIdentityText(value).includes(normalizedBrand),
  );
}

function getExtractedBrandRankingAdjustment(
  candidate: BottleCandidate,
  extractedLabel: BottleReferenceIdentity | null,
) {
  if (!extractedLabel?.brand) {
    return 0;
  }

  return candidateMatchesKnownBrand(candidate, extractedLabel.brand) ? 0.03 : 0;
}

type CandidateBottleMetadataRow = {
  bottleId: number;
  groupId: number | null;
  brand: string | null;
  bottler: string | null;
  series: string | null;
  category: BottleCandidate["category"];
  statedAge: number | null;
  edition: string | null;
  caskStrength: boolean | null;
  singleCask: boolean | null;
  abv: number | null;
  vintageYear: number | null;
  releaseYear: number | null;
  caskType: BottleCandidate["caskType"];
  caskSize: BottleCandidate["caskSize"];
  caskFill: BottleCandidate["caskFill"];
};

type CandidateBottleSiblingRow = {
  bottleId: number;
  groupId: number | null;
  fullName: string;
  statedAge: number | null;
  edition: string | null;
  caskStrength: boolean | null;
  singleCask: boolean | null;
  abv: number | null;
  vintageYear: number | null;
  releaseYear: number | null;
  caskType: BottleCandidate["caskType"];
  caskSize: BottleCandidate["caskSize"];
  caskFill: BottleCandidate["caskFill"];
};

function getPopulatedBottleTraitFields(
  row: Partial<Record<BottleCandidateTraitField, unknown>>,
  {
    includeStatedAge = true,
  }: {
    includeStatedAge?: boolean;
  } = {},
): BottleCandidateTraitField[] {
  return BOTTLE_DECISION_TRAIT_FIELDS.filter((field) => {
    if (field === "statedAge" && !includeStatedAge) {
      return false;
    }

    const value = row[field];
    return value !== null && value !== undefined && value !== "";
  });
}

function buildCandidateFamilyContext({
  siblingBottles,
}: {
  siblingBottles: BottleCandidateFamilyContext["siblingBottles"];
}): BottleCandidateFamilyContext {
  return {
    siblingBottles,
  };
}

function buildBottleSiblingContext(
  candidateMetadata: CandidateBottleMetadataRow[],
  siblingRows: CandidateBottleSiblingRow[],
): Map<number, BottleCandidateFamilyContext["siblingBottles"]> {
  const siblingRowsByGroupId = new Map<number, CandidateBottleSiblingRow[]>();
  for (const sibling of siblingRows) {
    if (sibling.groupId === null) {
      continue;
    }

    const groupSiblings = siblingRowsByGroupId.get(sibling.groupId) ?? [];
    groupSiblings.push(sibling);
    siblingRowsByGroupId.set(sibling.groupId, groupSiblings);
  }

  const siblingContextByBottleId = new Map<
    number,
    BottleCandidateFamilyContext["siblingBottles"]
  >();
  for (const candidate of candidateMetadata) {
    if (candidate.groupId === null) {
      siblingContextByBottleId.set(candidate.bottleId, []);
      continue;
    }

    const groupSiblings = (
      siblingRowsByGroupId.get(candidate.groupId) ?? []
    ).filter((sibling) => sibling.bottleId !== candidate.bottleId);

    siblingContextByBottleId.set(
      candidate.bottleId,
      groupSiblings
        .sort((left, right) => left.fullName.localeCompare(right.fullName))
        .slice(0, CANDIDATE_SIBLING_LIMIT)
        .map((sibling) => ({
          bottleId: sibling.bottleId,
          fullName: sibling.fullName,
          traitFields: getPopulatedBottleTraitFields(sibling),
          statedAge: sibling.statedAge,
          edition: sibling.edition,
          releaseYear: sibling.releaseYear,
          vintageYear: sibling.vintageYear,
          abv: sibling.abv,
          singleCask: sibling.singleCask,
          caskStrength: sibling.caskStrength,
          caskType: sibling.caskType,
          caskSize: sibling.caskSize,
          caskFill: sibling.caskFill,
        })),
    );
  }

  return siblingContextByBottleId;
}

async function enrichBottleCandidates(
  candidates: BottleCandidate[],
  database: AnyDatabase = db,
) {
  if (!candidates.length) {
    return candidates;
  }

  const bottleIds = candidates.map((candidate) => candidate.bottleId);
  const brandEntity = alias(entities, "price_match_brand");
  const bottlerEntity = alias(entities, "price_match_bottler");
  const distillerEntity = alias(entities, "price_match_distiller");

  const bottleRows = await database
    .select({
      bottleId: bottles.id,
      groupId: bottles.groupId,
      brand: brandEntity.name,
      bottler: bottlerEntity.name,
      series: bottleSeries.name,
      category: bottles.category,
      statedAge: bottles.statedAge,
      edition: bottles.edition,
      caskStrength: bottles.caskStrength,
      singleCask: bottles.singleCask,
      abv: bottles.abv,
      vintageYear: bottles.vintageYear,
      releaseYear: bottles.releaseYear,
      caskType: bottles.caskType,
      caskSize: bottles.caskSize,
      caskFill: bottles.caskFill,
    })
    .from(bottles)
    .innerJoin(brandEntity, eq(brandEntity.id, bottles.brandId))
    .leftJoin(bottlerEntity, eq(bottlerEntity.id, bottles.bottlerId))
    .leftJoin(bottleSeries, eq(bottleSeries.id, bottles.seriesId))
    .where(inArray(bottles.id, bottleIds));

  const bottleMetadataById = new Map<number, CandidateBottleMetadataRow>(
    bottleRows.map((row) => [row.bottleId, row]),
  );
  const groupIds = Array.from(
    new Set(
      bottleRows
        .map((row) => row.groupId)
        .filter((groupId): groupId is number => groupId !== null),
    ),
  );
  const siblingRows =
    groupIds.length === 0
      ? []
      : await database
          .select({
            bottleId: bottles.id,
            groupId: bottles.groupId,
            fullName: bottles.fullName,
            statedAge: bottles.statedAge,
            edition: bottles.edition,
            caskStrength: bottles.caskStrength,
            singleCask: bottles.singleCask,
            abv: bottles.abv,
            vintageYear: bottles.vintageYear,
            releaseYear: bottles.releaseYear,
            caskType: bottles.caskType,
            caskSize: bottles.caskSize,
            caskFill: bottles.caskFill,
          })
          .from(bottles)
          .where(
            and(
              inArray(bottles.groupId, groupIds),
              sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
            ),
          );
  const siblingBottlesByBottleId = buildBottleSiblingContext(
    bottleRows,
    siblingRows,
  );

  const distilleryRows = await database
    .select({
      bottleId: bottlesToDistillers.bottleId,
      distillery: distillerEntity.name,
    })
    .from(bottlesToDistillers)
    .innerJoin(
      distillerEntity,
      eq(distillerEntity.id, bottlesToDistillers.distillerId),
    )
    .where(inArray(bottlesToDistillers.bottleId, bottleIds));

  const distilleryNamesByBottleId = new Map<number, string[]>();
  for (const row of distilleryRows) {
    const existing = distilleryNamesByBottleId.get(row.bottleId) ?? [];
    if (!existing.some((value) => textsOverlap(value, row.distillery))) {
      existing.push(row.distillery);
      distilleryNamesByBottleId.set(row.bottleId, existing);
    }
  }

  const enrichedCandidates = new Map<number, BottleCandidate>();

  for (const candidate of candidates) {
    const bottleMetadata = bottleMetadataById.get(candidate.bottleId);
    if (!bottleMetadata) {
      mergeBottleCandidate(enrichedCandidates, candidate);
      continue;
    }

    if (!candidate.brand && bottleMetadata.brand) {
      candidate.brand = bottleMetadata.brand;
    }

    if (!candidate.bottler && bottleMetadata.bottler) {
      candidate.bottler = bottleMetadata.bottler;
    }

    if (!candidate.series && bottleMetadata.series) {
      candidate.series = bottleMetadata.series;
    }

    const distilleryNames =
      distilleryNamesByBottleId.get(candidate.bottleId) ?? [];
    const familyContext = buildCandidateFamilyContext({
      siblingBottles: siblingBottlesByBottleId.get(candidate.bottleId) ?? [],
    });
    if (!candidate.distillery.length && distilleryNames.length) {
      candidate.distillery = distilleryNames;
    } else if (distilleryNames.length) {
      candidate.distillery = Array.from(
        new Set([...candidate.distillery, ...distilleryNames]),
      );
    }

    candidate.category ??= bottleMetadata.category;
    candidate.statedAge ??= bottleMetadata.statedAge;
    candidate.edition ??= bottleMetadata.edition;
    candidate.caskStrength ??= bottleMetadata.caskStrength;
    candidate.singleCask ??= bottleMetadata.singleCask;
    candidate.abv ??= bottleMetadata.abv;
    candidate.vintageYear ??= bottleMetadata.vintageYear;
    candidate.releaseYear ??= bottleMetadata.releaseYear;
    candidate.caskType ??= bottleMetadata.caskType;
    candidate.caskSize ??= bottleMetadata.caskSize;
    candidate.caskFill ??= bottleMetadata.caskFill;
    candidate.familyContext = mergeBottleCandidateFamilyContext(
      candidate.familyContext,
      familyContext,
    );

    mergeBottleCandidate(enrichedCandidates, candidate);
  }

  return Array.from(enrichedCandidates.values());
}

async function runCandidateLookupSafely<T>(
  source: string,
  priceName: string,
  fallback: T,
  cb: () => Promise<T>,
): Promise<T> {
  try {
    return await cb();
  } catch (err) {
    logError(err, {
      price: {
        name: priceName,
      },
      candidateSource: {
        name: source,
      },
    });
    return fallback;
  }
}

async function getVectorCandidates(
  queryText: string,
  workload: AIGatewayWorkload,
): Promise<BottleCandidate[]> {
  if (!isAIGatewayConfigured(workload) || !queryText.trim()) {
    return [];
  }

  const embedding =
    workload === "scraper"
      ? await getOpenAIEmbedding(queryText, { workload })
      : await getOpenAIEmbedding(queryText);
  const vector = sql.raw(`'[${embedding.join(",")}]'::vector`);

  const result = await db.execute<{
    bottleId: number;
    alias: string | null;
    fullName: string;
    brand: string | null;
    category: BottleCandidate["category"];
    statedAge: number | null;
    edition: string | null;
    caskStrength: boolean | null;
    singleCask: boolean | null;
    abv: number | null;
    vintageYear: number | null;
    releaseYear: number | null;
    caskType: string | null;
    caskSize: string | null;
    caskFill: string | null;
    score: number | null;
  }>(sql`
    SELECT
      ${bottleAliases.bottleId} AS "bottleId",
      ${bottleAliases.name} AS alias,
      ${bottles.fullName} AS "fullName",
      ${entities.name} AS brand,
      ${bottles.category} AS category,
      ${bottles.statedAge} AS "statedAge",
      ${bottles.edition} AS edition,
      ${bottles.caskStrength} AS "caskStrength",
      ${bottles.singleCask} AS "singleCask",
      ${bottles.abv} AS abv,
      ${bottles.vintageYear} AS "vintageYear",
      ${bottles.releaseYear} AS "releaseYear",
      ${bottles.caskType} AS "caskType",
      ${bottles.caskSize} AS "caskSize",
      ${bottles.caskFill} AS "caskFill",
      1 - (${bottleAliases.embedding} <=> ${vector}) AS score
    FROM ${bottleAliases}
    INNER JOIN ${bottles}
      ON ${bottles.id} = ${bottleAliases.bottleId}
    INNER JOIN ${entities} ON ${entities.id} = ${bottles.brandId}
    WHERE ${bottleAliases.embedding} IS NOT NULL
      AND ${bottleAliases.ignored} = false
      AND NOT EXISTS(
        SELECT FROM ${bottleTombstones}
        WHERE ${bottleTombstones.bottleId} = ${bottles.id}
      )
    ORDER BY ${bottleAliases.embedding} <=> ${vector}
    LIMIT ${VECTOR_CANDIDATE_LIMIT}
  `);

  return result.rows.map((row) => buildBottleCandidate(row, "vector"));
}

async function getTextCandidates(
  queryText: string,
): Promise<BottleCandidate[]> {
  if (!queryText.trim()) {
    return [];
  }
  const textQuery = webSearchQuery(queryText);

  const result = await db.execute<{
    bottleId: number;
    fullName: string;
    brand: string | null;
    category: BottleCandidate["category"];
    statedAge: number | null;
    edition: string | null;
    caskStrength: boolean | null;
    singleCask: boolean | null;
    abv: number | null;
    vintageYear: number | null;
    releaseYear: number | null;
    caskType: string | null;
    caskSize: string | null;
    caskFill: string | null;
    score: number | null;
  }>(sql`
    SELECT
      ${bottles.id} AS "bottleId",
      ${bottles.fullName} AS "fullName",
      ${entities.name} AS brand,
      ${bottles.category} AS category,
      ${bottles.statedAge} AS "statedAge",
      ${bottles.edition} AS edition,
      ${bottles.caskStrength} AS "caskStrength",
      ${bottles.singleCask} AS "singleCask",
      ${bottles.abv} AS abv,
      ${bottles.vintageYear} AS "vintageYear",
      ${bottles.releaseYear} AS "releaseYear",
      ${bottles.caskType} AS "caskType",
      ${bottles.caskSize} AS "caskSize",
      ${bottles.caskFill} AS "caskFill",
      ts_rank(${bottles.searchVector}, ${textQuery}) AS score
    FROM ${bottles}
    INNER JOIN ${entities} ON ${entities.id} = ${bottles.brandId}
    WHERE ${bottles.searchVector} IS NOT NULL
      AND ${bottles.searchVector} @@ ${textQuery}
      AND NOT EXISTS(
        SELECT FROM ${bottleTombstones}
        WHERE ${bottleTombstones.bottleId} = ${bottles.id}
      )
    ORDER BY score DESC, ${bottles.fullName} ASC
    LIMIT ${TEXT_CANDIDATE_LIMIT}
  `);

  return result.rows.map((row) => buildBottleCandidate(row, "text"));
}

async function getBrandCandidates(
  normalizedName: string,
  extractedLabel: BottleReferenceIdentity | null,
): Promise<BottleCandidate[]> {
  if (!extractedLabel?.brand && !extractedLabel?.bottler) {
    return [];
  }

  const brandName = (extractedLabel.brand ?? extractedLabel.bottler)?.trim();
  if (!brandName) {
    return [];
  }
  const smwsCode = getSmwsExtractedLabelCode(extractedLabel);
  const expression = smwsCode ?? extractedLabel.expression ?? normalizedName;
  const comparableExpression = normalizeComparableText(expression);
  const comparableExpressionClause = comparableExpression
    ? sql`OR LOWER(REPLACE(${bottles.fullName}, ${"'"}, '')) LIKE ${`%${comparableExpression}%`}`
    : sql``;
  const smwsCodePattern = smwsCode
    ? getExactCaskCodeSqlPattern(smwsCode)
    : null;
  const expressionClause = smwsCodePattern
    ? sql`(
        ${bottles.name} ~* ${smwsCodePattern}
        OR ${bottles.fullName} ~* ${smwsCodePattern}
      )`
    : sql`(
        LOWER(${bottles.fullName}) LIKE LOWER(${`%${expression}%`})
        ${comparableExpressionClause}
      )`;

  const result = await db.execute<{
    bottleId: number;
    fullName: string;
    brand: string | null;
    category: BottleCandidate["category"];
    statedAge: number | null;
    edition: string | null;
    caskStrength: boolean | null;
    singleCask: boolean | null;
    abv: number | null;
    vintageYear: number | null;
    releaseYear: number | null;
    caskType: string | null;
    caskSize: string | null;
    caskFill: string | null;
  }>(sql`
    SELECT
      ${bottles.id} AS "bottleId",
      ${bottles.fullName} AS "fullName",
      ${entities.name} AS brand
      , ${bottles.category} AS category
      , ${bottles.statedAge} AS "statedAge"
      , ${bottles.edition} AS edition
      , ${bottles.caskStrength} AS "caskStrength"
      , ${bottles.singleCask} AS "singleCask"
      , ${bottles.abv} AS abv
      , ${bottles.vintageYear} AS "vintageYear"
      , ${bottles.releaseYear} AS "releaseYear"
      , ${bottles.caskType} AS "caskType"
      , ${bottles.caskSize} AS "caskSize"
      , ${bottles.caskFill} AS "caskFill"
    FROM ${bottles}
    INNER JOIN ${entities} ON ${entities.id} = ${bottles.brandId}
    WHERE (
      LOWER(${entities.name}) = LOWER(${brandName})
      OR LOWER(COALESCE(${entities.shortName}, '')) = LOWER(${brandName})
    )
      AND ${expressionClause}
      AND NOT EXISTS(
        SELECT FROM ${bottleTombstones}
        WHERE ${bottleTombstones.bottleId} = ${bottles.id}
      )
    ORDER BY ${bottles.fullName} ASC
    LIMIT ${BRAND_CANDIDATE_LIMIT}
  `);

  return result.rows.map((row) => buildBottleCandidate(row, "brand"));
}

async function getOrdinaryBottleCandidateById(
  bottleId: number,
  database: AnyDatabase = db,
): Promise<BottleCandidate | null> {
  const [result] = await database
    .select({
      bottleId: bottles.id,
      fullName: bottles.fullName,
      brand: entities.name,
      category: bottles.category,
      statedAge: bottles.statedAge,
      edition: bottles.edition,
      caskStrength: bottles.caskStrength,
      singleCask: bottles.singleCask,
      abv: bottles.abv,
      vintageYear: bottles.vintageYear,
      releaseYear: bottles.releaseYear,
      caskType: bottles.caskType,
      caskSize: bottles.caskSize,
      caskFill: bottles.caskFill,
    })
    .from(bottles)
    .innerJoin(entities, eq(entities.id, bottles.brandId))
    .where(
      and(
        eq(bottles.id, bottleId),
        sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
      ),
    )
    .limit(1);

  if (!result) {
    return null;
  }

  const candidate = buildBottleCandidate(
    {
      bottleId: result.bottleId,
      fullName: result.fullName,
      brand: result.brand,
      category: result.category,
      statedAge: result.statedAge,
      edition: result.edition,
      caskStrength: result.caskStrength,
      singleCask: result.singleCask,
      abv: result.abv,
      vintageYear: result.vintageYear,
      releaseYear: result.releaseYear,
      caskType: result.caskType,
      caskSize: result.caskSize,
      caskFill: result.caskFill,
      score: 1,
    },
    "current",
  );

  return (await enrichBottleCandidates([candidate], database))[0] ?? null;
}

export async function getBottleCandidateById(
  bottleId: number,
  database: AnyDatabase = db,
): Promise<BottleCandidate | null> {
  return await getOrdinaryBottleCandidateById(bottleId, database);
}

async function getExactBottleCandidate(
  normalizedName: string,
): Promise<BottleCandidate | null> {
  const normalizedLowerName = normalizedName.toLowerCase();
  const comparableName = normalizeComparableText(normalizedName);
  const exactMatches = await db
    .select({
      bottleId: bottles.id,
      alias: bottleAliases.name,
      fullName: bottles.fullName,
      brand: entities.name,
      category: bottles.category,
      statedAge: bottles.statedAge,
      edition: bottles.edition,
      caskStrength: bottles.caskStrength,
      singleCask: bottles.singleCask,
      abv: bottles.abv,
      vintageYear: bottles.vintageYear,
      releaseYear: bottles.releaseYear,
      caskType: bottles.caskType,
      caskSize: bottles.caskSize,
      caskFill: bottles.caskFill,
    })
    .from(bottleAliases)
    .innerJoin(bottles, eq(bottles.id, bottleAliases.bottleId))
    .innerJoin(entities, eq(entities.id, bottles.brandId))
    .where(
      and(
        sql`LOWER(${bottleAliases.name}) = ${normalizedLowerName}`,
        eq(bottleAliases.ignored, false),
        sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
      ),
    )
    .limit(1);

  const exactMatch = exactMatches[0];
  if (exactMatch?.bottleId) {
    return buildBottleCandidate(
      {
        bottleId: exactMatch.bottleId,
        alias: exactMatch.alias,
        fullName: exactMatch.fullName,
        brand: exactMatch.brand || null,
        category: exactMatch.category,
        statedAge: exactMatch.statedAge,
        edition: exactMatch.edition,
        caskStrength: exactMatch.caskStrength,
        singleCask: exactMatch.singleCask,
        abv: exactMatch.abv,
        vintageYear: exactMatch.vintageYear,
        releaseYear: exactMatch.releaseYear,
        caskType: exactMatch.caskType,
        caskSize: exactMatch.caskSize,
        caskFill: exactMatch.caskFill,
        score: 1,
      },
      "exact",
    );
  }

  if (!comparableName || comparableName === normalizedLowerName) {
    return null;
  }

  const comparableMatches = await db
    .select({
      bottleId: bottles.id,
      alias: bottleAliases.name,
      fullName: bottles.fullName,
      brand: entities.name,
      category: bottles.category,
      statedAge: bottles.statedAge,
      edition: bottles.edition,
      caskStrength: bottles.caskStrength,
      singleCask: bottles.singleCask,
      abv: bottles.abv,
      vintageYear: bottles.vintageYear,
      releaseYear: bottles.releaseYear,
      caskType: bottles.caskType,
      caskSize: bottles.caskSize,
      caskFill: bottles.caskFill,
    })
    .from(bottleAliases)
    .innerJoin(bottles, eq(bottles.id, bottleAliases.bottleId))
    .innerJoin(entities, eq(entities.id, bottles.brandId))
    .where(
      and(
        sql`LOWER(REPLACE(${bottleAliases.name}, ${"'"}, '')) = ${comparableName}`,
        eq(bottleAliases.ignored, false),
        sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
      ),
    )
    .limit(2);

  if (comparableMatches.length !== 1) {
    return null;
  }

  const comparableMatch = comparableMatches[0]!;

  return buildBottleCandidate(
    {
      bottleId: comparableMatch.bottleId,
      alias: comparableMatch.alias,
      fullName: comparableMatch.fullName,
      brand: comparableMatch.brand || null,
      category: comparableMatch.category,
      statedAge: comparableMatch.statedAge,
      edition: comparableMatch.edition,
      caskStrength: comparableMatch.caskStrength,
      singleCask: comparableMatch.singleCask,
      abv: comparableMatch.abv,
      vintageYear: comparableMatch.vintageYear,
      releaseYear: comparableMatch.releaseYear,
      caskType: comparableMatch.caskType,
      caskSize: comparableMatch.caskSize,
      caskFill: comparableMatch.caskFill,
      score: 1,
    },
    "exact",
  );
}

async function getExactBottleCandidateByNames(
  normalizedNames: string[],
): Promise<BottleCandidate | null> {
  for (const normalizedName of normalizedNames) {
    const candidate = await getExactBottleCandidate(normalizedName);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

export async function findBottleReferenceCandidates(
  reference: {
    name: string;
    bottleId?: number | null;
  },
  extractedLabel: BottleExtractedDetails | null,
  { workload = "application" }: { workload?: AIGatewayWorkload } = {},
) {
  return await searchBottleCandidates(
    {
      query: reference.name,
      brand: extractedLabel?.brand ?? null,
      bottler: extractedLabel?.bottler ?? null,
      expression: extractedLabel?.expression ?? null,
      series: extractedLabel?.series ?? null,
      distillery: extractedLabel?.distillery ?? [],
      category: normalizeMatchCategory(extractedLabel?.category ?? null),
      stated_age: extractedLabel?.stated_age ?? null,
      abv: extractedLabel?.abv ?? null,
      cask_type: extractedLabel?.cask_type ?? null,
      cask_size: extractedLabel?.cask_size ?? null,
      cask_fill: extractedLabel?.cask_fill ?? null,
      cask_strength: extractedLabel?.cask_strength ?? null,
      single_cask: extractedLabel?.single_cask ?? null,
      edition: extractedLabel?.edition ?? null,
      vintage_year: extractedLabel?.vintage_year ?? null,
      release_year: extractedLabel?.release_year ?? null,
      currentBottleId: reference.bottleId ?? null,
    },
    { workload },
  );
}

export async function searchBottleCandidates(
  rawInput: BottleCandidateSearchInputRequest,
  { workload = "application" }: { workload?: AIGatewayWorkload } = {},
) {
  const input = normalizePotentialProofLikeAbvFields(
    BottleCandidateSearchInputSchema.parse(rawInput),
  );
  const searchName = buildRawSearchName(input);
  if (!searchName) {
    return [];
  }

  const extractedLabel = buildSearchLabel(input);
  const normalizedName = getNormalizedPriceName(searchName);
  const exactSearchNames = buildExactSearchNames([
    normalizedName,
    input.query ? getNormalizedPriceName(input.query) : null,
  ]);
  const queryText = buildQueryText(normalizedName, extractedLabel);
  const candidates = new Map<number, BottleCandidate>();

  const [
    currentCandidate,
    vectorCandidates,
    textCandidates,
    brandCandidates,
    exactCandidate,
  ] = await Promise.all([
    input.currentBottleId
      ? runCandidateLookupSafely(
          "current",
          searchName,
          null,
          async () => await getBottleCandidateById(input.currentBottleId!),
        )
      : Promise.resolve(null),
    runCandidateLookupSafely(
      "vector",
      searchName,
      [] as BottleCandidate[],
      async () => await getVectorCandidates(queryText, workload),
    ),
    runCandidateLookupSafely(
      "text",
      searchName,
      [] as BottleCandidate[],
      async () => await getTextCandidates(queryText),
    ),
    runCandidateLookupSafely(
      "brand",
      searchName,
      [] as BottleCandidate[],
      async () => await getBrandCandidates(normalizedName, extractedLabel),
    ),
    runCandidateLookupSafely(
      "exact",
      searchName,
      null as BottleCandidate | null,
      async () => await getExactBottleCandidateByNames(exactSearchNames),
    ),
  ]);

  if (currentCandidate) {
    mergeBottleCandidate(candidates, currentCandidate);
  }
  for (const candidate of vectorCandidates) {
    mergeBottleCandidate(candidates, candidate);
  }
  for (const candidate of textCandidates) {
    mergeBottleCandidate(candidates, candidate);
  }
  for (const candidate of brandCandidates) {
    mergeBottleCandidate(candidates, candidate);
  }
  if (exactCandidate) {
    mergeBottleCandidate(candidates, exactCandidate);
  }
  const enrichedCandidates = await enrichBottleCandidates(
    Array.from(candidates.values()),
  );

  return enrichedCandidates
    .sort(
      (a, b) =>
        getCandidateSortScore(b, extractedLabel) -
          getCandidateSortScore(a, extractedLabel) ||
        (b.score ?? 0) - (a.score ?? 0),
    )
    .slice(0, input.limit);
}
