import {
  extractFromImage,
  extractFromText,
} from "@peated/server/agents/whisky/labelExtractor";
import config from "@peated/server/config";
import { CATEGORY_LIST } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleReleases,
  bottleSeries,
  bottles,
  bottlesToDistillers,
  entities,
  type StorePrice,
} from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { normalizeBottle, normalizeString } from "@peated/server/lib/normalize";
import { absoluteUrl } from "@peated/server/lib/urls";
import {
  CaskFillEnum,
  CaskSizeEnum,
  ExtractedBottleDetailsSchema,
  PriceMatchCandidateSchema,
} from "@peated/server/schemas";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getOpenAIEmbedding } from "./openaiEmbeddings";

const VECTOR_CANDIDATE_LIMIT = 20;
const TEXT_CANDIDATE_LIMIT = 10;
const BRAND_CANDIDATE_LIMIT = 5;
const MATCH_CANDIDATE_LIMIT = 15;

type ExtractedBottleDetails = z.infer<typeof ExtractedBottleDetailsSchema>;
type PriceMatchCandidate = z.infer<typeof PriceMatchCandidateSchema>;
type RawPriceMatchCandidateRow = {
  kind?: "bottle" | "release" | null;
  bottleId: number | string;
  releaseId?: number | string | null;
  alias?: string | null;
  fullName: string;
  bottleFullName?: string | null;
  brand?: string | null;
  bottler?: string | null;
  series?: string | null;
  distillery?: string[] | null;
  category?: z.infer<typeof ExtractedBottleDetailsSchema>["category"] | null;
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

function normalizeMatchCategory<
  T extends null | z.infer<typeof ExtractedBottleDetailsSchema>["category"],
>(category: T) {
  return category === "spirit" ? null : category;
}

export const BottleCandidateSearchInputSchema = z.object({
  query: z.string().trim().nullable().default(null),
  brand: z.string().trim().nullable().default(null),
  bottler: z.string().trim().nullable().default(null),
  expression: z.string().trim().nullable().default(null),
  series: z.string().trim().nullable().default(null),
  distillery: z.array(z.string().trim()).default([]),
  category: z.enum(CATEGORY_LIST).nullable().default(null),
  stated_age: z.number().nullable().default(null),
  abv: z.number().min(0).max(100).nullable().default(null),
  cask_type: z.string().trim().nullable().default(null),
  cask_size: CaskSizeEnum.nullable().default(null),
  cask_fill: CaskFillEnum.nullable().default(null),
  cask_strength: z.boolean().nullable().default(null),
  single_cask: z.boolean().nullable().default(null),
  edition: z.string().trim().nullable().default(null),
  vintage_year: z.number().int().nullable().default(null),
  release_year: z.number().int().nullable().default(null),
  currentBottleId: z.number().nullable().default(null),
  currentReleaseId: z.number().nullable().default(null),
  limit: z.number().int().min(1).max(25).default(MATCH_CANDIDATE_LIMIT),
});

type BottleCandidateSearchInput = z.infer<
  typeof BottleCandidateSearchInputSchema
>;
type BottleCandidateSearchInputRequest = z.input<
  typeof BottleCandidateSearchInputSchema
>;

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
] as const satisfies ReadonlyArray<keyof PriceMatchCandidate>;

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
): ExtractedBottleDetails | null {
  if (
    !input.brand &&
    !input.bottler &&
    !input.expression &&
    !input.series &&
    !input.distillery.length &&
    !input.category &&
    !input.stated_age &&
    input.abv === null &&
    !input.cask_type &&
    input.cask_size === null &&
    input.cask_fill === null &&
    input.cask_strength === null &&
    input.single_cask === null &&
    !input.edition &&
    !input.vintage_year &&
    !input.release_year
  ) {
    return null;
  }

  return ExtractedBottleDetailsSchema.parse({
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
    input.cask_type,
    input.cask_size,
    input.cask_fill,
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
      input.cask_type ||
      input.cask_size ||
      input.cask_fill ||
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

function getPriceMatchCandidateKey(
  candidate: Pick<PriceMatchCandidate, "bottleId" | "releaseId" | "kind">,
) {
  return candidate.releaseId !== null || candidate.kind === "release"
    ? `release:${candidate.releaseId ?? "missing"}`
    : `bottle:${candidate.bottleId}`;
}

export function mergePriceMatchCandidate(
  candidates: Map<string, PriceMatchCandidate>,
  candidate: PriceMatchCandidate,
) {
  const key = getPriceMatchCandidateKey(candidate);
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

  if (!existing.distillery.length && candidate.distillery.length) {
    existing.distillery = candidate.distillery;
  } else if (candidate.distillery.length) {
    existing.distillery = Array.from(
      new Set([...existing.distillery, ...candidate.distillery]),
    );
  }

  const existingMetadata = existing as Record<
    (typeof CANDIDATE_METADATA_FIELDS)[number],
    PriceMatchCandidate[(typeof CANDIDATE_METADATA_FIELDS)[number]]
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

function buildPriceMatchCandidate(
  row: RawPriceMatchCandidateRow,
  source: string,
): PriceMatchCandidate {
  return PriceMatchCandidateSchema.parse({
    kind: row.kind ?? (row.releaseId ? "release" : "bottle"),
    bottleId: Number(row.bottleId),
    releaseId:
      row.releaseId === undefined || row.releaseId === null
        ? null
        : Number(row.releaseId),
    alias: row.alias ?? null,
    fullName: row.fullName,
    bottleFullName: row.bottleFullName ?? row.fullName,
    brand: row.brand ?? null,
    bottler: row.bottler ?? null,
    series: row.series ?? null,
    distillery: row.distillery ?? [],
    category: row.category ?? null,
    statedAge: parseNullableNumber(row.statedAge),
    edition: row.edition ?? null,
    caskStrength: row.caskStrength ?? null,
    singleCask: row.singleCask ?? null,
    abv: parseNullableNumber(row.abv),
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

export async function extractStorePriceBottleDetails(
  price: Pick<StorePrice, "name" | "imageUrl">,
): Promise<ExtractedBottleDetails | null> {
  try {
    const extractedDetails = await (price.imageUrl
      ? extractFromImage(absoluteUrl(config.API_SERVER, price.imageUrl))
      : extractFromText(price.name));

    if (!extractedDetails) {
      return null;
    }

    const parsedDetails = ExtractedBottleDetailsSchema.parse(extractedDetails);

    return {
      ...parsedDetails,
      category: normalizeMatchCategory(parsedDetails.category),
    };
  } catch (err) {
    logError(err, {
      price: {
        name: price.name,
      },
    });
    return null;
  }
}

function buildQueryText(
  normalizedName: string,
  extractedLabel: ExtractedBottleDetails | null,
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
  if (extractedLabel?.cask_type) parts.push(extractedLabel.cask_type);
  if (extractedLabel?.cask_size) parts.push(extractedLabel.cask_size);
  if (extractedLabel?.cask_fill) parts.push(extractedLabel.cask_fill);
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

function normalizeIdentityText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return normalizeString(value).toLowerCase().trim();
}

function normalizeComparableText(value: string | null | undefined) {
  return normalizeIdentityText(value).replace(/_/g, " ");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  candidate: PriceMatchCandidate,
  extractedLabel: ExtractedBottleDetails | null,
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

  if (extractedLabel.cask_type && candidate.caskType) {
    adjustment += textsOverlap(candidate.caskType, extractedLabel.cask_type)
      ? 0.08
      : -0.14;
  }

  if (extractedLabel.cask_size && candidate.caskSize) {
    adjustment += textsOverlap(candidate.caskSize, extractedLabel.cask_size)
      ? 0.06
      : -0.1;
  }

  if (extractedLabel.cask_fill && candidate.caskFill) {
    adjustment += textsOverlap(candidate.caskFill, extractedLabel.cask_fill)
      ? 0.05
      : -0.08;
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
  candidate: PriceMatchCandidate,
  extractedLabel: ExtractedBottleDetails | null,
) {
  const releaseAdjustment = hasReleaseSpecificIdentity(extractedLabel)
    ? candidate.kind === "release"
      ? 0.08
      : -0.04
    : candidate.kind === "bottle"
      ? 0.04
      : -0.02;

  return (
    (candidate.score ?? 0) +
    getStructuredCandidateAdjustment(candidate, extractedLabel) +
    releaseAdjustment
  );
}

function candidateMatchesKnownBrand(
  candidate: PriceMatchCandidate,
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

function filterCandidatesByKnownBrand(
  candidates: PriceMatchCandidate[],
  extractedLabel: ExtractedBottleDetails | null,
) {
  if (!extractedLabel?.brand) {
    return candidates;
  }

  const sameBrandCandidateIds = new Set(
    candidates
      .filter((candidate) =>
        candidateMatchesKnownBrand(candidate, extractedLabel.brand!),
      )
      .map((candidate) => candidate.bottleId),
  );

  if (!sameBrandCandidateIds.size) {
    return candidates;
  }

  return candidates.filter(
    (candidate) =>
      sameBrandCandidateIds.has(candidate.bottleId) ||
      candidate.source.includes("exact") ||
      candidate.source.includes("current"),
  );
}

type CandidateBottleMetadataRow = {
  bottleId: number;
  brand: string | null;
  bottler: string | null;
  series: string | null;
  category: PriceMatchCandidate["category"];
  statedAge: number | null;
  edition: string | null;
  caskStrength: boolean | null;
  singleCask: boolean | null;
  abv: number | null;
  vintageYear: number | null;
  releaseYear: number | null;
  caskType: PriceMatchCandidate["caskType"];
  caskSize: PriceMatchCandidate["caskSize"];
  caskFill: PriceMatchCandidate["caskFill"];
};

type CandidateReleaseMetadataRow = {
  releaseId: number;
  bottleId: number;
  fullName: string;
  statedAge: number | null;
  edition: string | null;
  caskStrength: boolean | null;
  singleCask: boolean | null;
  abv: number | null;
  vintageYear: number | null;
  releaseYear: number | null;
  caskType: PriceMatchCandidate["caskType"];
  caskSize: PriceMatchCandidate["caskSize"];
  caskFill: PriceMatchCandidate["caskFill"];
};

function hasReleaseSpecificIdentity(
  extractedLabel: ExtractedBottleDetails | null,
) {
  return Boolean(
    extractedLabel &&
      (extractedLabel.stated_age !== null ||
        extractedLabel.edition ||
        extractedLabel.abv !== null ||
        extractedLabel.vintage_year !== null ||
        extractedLabel.release_year !== null ||
        extractedLabel.cask_type ||
        extractedLabel.cask_size !== null ||
        extractedLabel.cask_fill !== null ||
        extractedLabel.cask_strength !== null ||
        extractedLabel.single_cask !== null),
  );
}

function getReleaseMetadataScore(
  release: CandidateReleaseMetadataRow,
  extractedLabel: ExtractedBottleDetails | null,
) {
  if (!extractedLabel) {
    return 0;
  }

  let score = 0;

  if (extractedLabel.stated_age !== null && release.statedAge !== null) {
    score += release.statedAge === extractedLabel.stated_age ? 6 : -10;
  }

  if (extractedLabel.edition && release.edition) {
    score += textsOverlap(release.edition, extractedLabel.edition) ? 7 : -12;
  }

  if (extractedLabel.cask_type && release.caskType) {
    score += textsOverlap(release.caskType, extractedLabel.cask_type) ? 5 : -8;
  }

  if (extractedLabel.cask_size && release.caskSize) {
    score += textsOverlap(release.caskSize, extractedLabel.cask_size) ? 4 : -6;
  }

  if (extractedLabel.cask_fill && release.caskFill) {
    score += textsOverlap(release.caskFill, extractedLabel.cask_fill) ? 4 : -6;
  }

  if (extractedLabel.cask_strength !== null && release.caskStrength !== null) {
    score += release.caskStrength === extractedLabel.cask_strength ? 4 : -6;
  }

  if (extractedLabel.single_cask !== null && release.singleCask !== null) {
    score += release.singleCask === extractedLabel.single_cask ? 4 : -6;
  }

  if (extractedLabel.vintage_year !== null && release.vintageYear !== null) {
    score += release.vintageYear === extractedLabel.vintage_year ? 5 : -8;
  }

  if (extractedLabel.release_year !== null && release.releaseYear !== null) {
    score += release.releaseYear === extractedLabel.release_year ? 5 : -8;
  }

  if (extractedLabel.abv !== null && release.abv !== null) {
    const difference = Math.abs(release.abv - extractedLabel.abv);
    if (difference <= 0.15) {
      score += 6;
    } else if (difference <= 0.4) {
      score += 4;
    } else if (difference >= 1) {
      score -= 8;
    }
  }

  return score;
}

function getPreferredReleaseMetadata(
  releases: CandidateReleaseMetadataRow[],
  extractedLabel: ExtractedBottleDetails | null,
) {
  if (!releases.length) {
    return null;
  }

  if (!hasReleaseSpecificIdentity(extractedLabel)) {
    return releases.length === 1 ? releases[0] : null;
  }

  const sortedReleases = [...releases]
    .map((release) => ({
      release,
      score: getReleaseMetadataScore(release, extractedLabel),
    }))
    .sort((left, right) => right.score - left.score);

  if (!sortedReleases.length) {
    return null;
  }

  if (sortedReleases[0]!.score > 0 || releases.length === 1) {
    return sortedReleases[0]!.release;
  }

  return null;
}

async function enrichPriceMatchCandidates(
  candidates: PriceMatchCandidate[],
  extractedLabel: ExtractedBottleDetails | null,
) {
  if (!candidates.length) {
    return candidates;
  }

  const bottleIds = candidates.map((candidate) => candidate.bottleId);
  const brandEntity = alias(entities, "price_match_brand");
  const bottlerEntity = alias(entities, "price_match_bottler");
  const distillerEntity = alias(entities, "price_match_distiller");

  const bottleRows = await db
    .select({
      bottleId: bottles.id,
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

  const distilleryRows = await db
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

  const releaseRows = await db
    .select({
      releaseId: bottleReleases.id,
      bottleId: bottleReleases.bottleId,
      fullName: bottleReleases.fullName,
      statedAge: bottleReleases.statedAge,
      edition: bottleReleases.edition,
      caskStrength: bottleReleases.caskStrength,
      singleCask: bottleReleases.singleCask,
      abv: bottleReleases.abv,
      vintageYear: bottleReleases.vintageYear,
      releaseYear: bottleReleases.releaseYear,
      caskType: bottleReleases.caskType,
      caskSize: bottleReleases.caskSize,
      caskFill: bottleReleases.caskFill,
    })
    .from(bottleReleases)
    .where(inArray(bottleReleases.bottleId, bottleIds));

  const releasesByBottleId = new Map<number, CandidateReleaseMetadataRow[]>();
  const releaseMetadataById = new Map<number, CandidateReleaseMetadataRow>();
  for (const row of releaseRows) {
    const existing = releasesByBottleId.get(row.bottleId) ?? [];
    existing.push(row);
    releasesByBottleId.set(row.bottleId, existing);
    releaseMetadataById.set(row.releaseId, row);
  }

  for (const candidate of candidates) {
    const bottleMetadata = bottleMetadataById.get(candidate.bottleId);
    if (!bottleMetadata) {
      continue;
    }

    const preferredRelease =
      candidate.releaseId != null
        ? (releaseMetadataById.get(candidate.releaseId) ?? null)
        : getPreferredReleaseMetadata(
            releasesByBottleId.get(candidate.bottleId) ?? [],
            extractedLabel,
          );

    if (!candidate.brand && bottleMetadata.brand) {
      candidate.brand = bottleMetadata.brand;
    }

    if (!candidate.bottler && bottleMetadata.bottler) {
      candidate.bottler = bottleMetadata.bottler;
    }

    if (!candidate.series && bottleMetadata.series) {
      candidate.series = bottleMetadata.series;
    }

    if (candidate.kind === "release" && preferredRelease?.fullName) {
      candidate.fullName = preferredRelease.fullName;
    }

    const distilleryNames =
      distilleryNamesByBottleId.get(candidate.bottleId) ?? [];
    if (!candidate.distillery.length && distilleryNames.length) {
      candidate.distillery = distilleryNames;
    } else if (distilleryNames.length) {
      candidate.distillery = Array.from(
        new Set([...candidate.distillery, ...distilleryNames]),
      );
    }

    candidate.category ??= bottleMetadata.category;
    candidate.statedAge ??=
      preferredRelease?.statedAge ?? bottleMetadata.statedAge;
    candidate.edition ??= preferredRelease?.edition ?? bottleMetadata.edition;
    candidate.caskStrength ??=
      preferredRelease?.caskStrength ?? bottleMetadata.caskStrength;
    candidate.singleCask ??=
      preferredRelease?.singleCask ?? bottleMetadata.singleCask;
    candidate.abv ??= preferredRelease?.abv ?? bottleMetadata.abv;
    candidate.vintageYear ??=
      preferredRelease?.vintageYear ?? bottleMetadata.vintageYear;
    candidate.releaseYear ??=
      preferredRelease?.releaseYear ?? bottleMetadata.releaseYear;
    candidate.caskType ??=
      preferredRelease?.caskType ?? bottleMetadata.caskType;
    candidate.caskSize ??=
      preferredRelease?.caskSize ?? bottleMetadata.caskSize;
    candidate.caskFill ??=
      preferredRelease?.caskFill ?? bottleMetadata.caskFill;

    if (
      preferredRelease &&
      (candidate.releaseId !== null ||
        hasReleaseSpecificIdentity(extractedLabel))
    ) {
      candidate.source = Array.from(new Set([...candidate.source, "release"]));
    }
  }

  return candidates;
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
): Promise<PriceMatchCandidate[]> {
  if (!config.OPENAI_API_KEY || !queryText.trim()) {
    return [];
  }

  const embedding = await getOpenAIEmbedding(queryText);
  const vector = sql.raw(`'[${embedding.join(",")}]'::vector`);

  const result = await db.execute<{
    bottleId: number;
    releaseId: number | null;
    alias: string | null;
    fullName: string;
    bottleFullName: string;
    brand: string | null;
    category: z.infer<typeof ExtractedBottleDetailsSchema>["category"] | null;
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
      ${bottleAliases.releaseId} AS "releaseId",
      ${bottleAliases.name} AS alias,
      COALESCE(${bottleReleases.fullName}, ${bottles.fullName}) AS "fullName",
      ${bottles.fullName} AS "bottleFullName",
      ${entities.name} AS brand,
      ${bottles.category} AS category,
      COALESCE(${bottleReleases.statedAge}, ${bottles.statedAge}) AS "statedAge",
      COALESCE(${bottleReleases.edition}, ${bottles.edition}) AS edition,
      COALESCE(${bottleReleases.caskStrength}, ${bottles.caskStrength}) AS "caskStrength",
      COALESCE(${bottleReleases.singleCask}, ${bottles.singleCask}) AS "singleCask",
      COALESCE(${bottleReleases.abv}, ${bottles.abv}) AS abv,
      COALESCE(${bottleReleases.vintageYear}, ${bottles.vintageYear}) AS "vintageYear",
      COALESCE(${bottleReleases.releaseYear}, ${bottles.releaseYear}) AS "releaseYear",
      COALESCE(${bottleReleases.caskType}, ${bottles.caskType}) AS "caskType",
      COALESCE(${bottleReleases.caskSize}, ${bottles.caskSize}) AS "caskSize",
      COALESCE(${bottleReleases.caskFill}, ${bottles.caskFill}) AS "caskFill",
      1 - (${bottleAliases.embedding} <=> ${vector}) AS score
    FROM ${bottleAliases}
    INNER JOIN ${bottles} ON ${bottles.id} = ${bottleAliases.bottleId}
    LEFT JOIN ${bottleReleases} ON ${bottleReleases.id} = ${bottleAliases.releaseId}
    INNER JOIN ${entities} ON ${entities.id} = ${bottles.brandId}
    WHERE ${bottleAliases.embedding} IS NOT NULL
      AND ${bottleAliases.bottleId} IS NOT NULL
      AND ${bottleAliases.ignored} = false
    ORDER BY ${bottleAliases.embedding} <=> ${vector}
    LIMIT ${VECTOR_CANDIDATE_LIMIT}
  `);

  return result.rows.map((row) => buildPriceMatchCandidate(row, "vector"));
}

async function getTextCandidates(
  queryText: string,
): Promise<PriceMatchCandidate[]> {
  if (!queryText.trim()) {
    return [];
  }

  const result = await db.execute<{
    bottleId: number;
    fullName: string;
    bottleFullName: string;
    brand: string | null;
    category: z.infer<typeof ExtractedBottleDetailsSchema>["category"] | null;
    statedAge: number | null;
    edition: string | null;
    caskStrength: boolean | null;
    singleCask: boolean | null;
    abv: number | null;
    vintageYear: number | null;
    releaseYear: number | null;
    caskType: string | null;
    score: number | null;
  }>(sql`
    SELECT
      ${bottles.id} AS "bottleId",
      ${bottles.fullName} AS "fullName",
      ${bottles.fullName} AS "bottleFullName",
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
      ts_rank(${bottles.searchVector}, websearch_to_tsquery('english', ${queryText})) AS score
    FROM ${bottles}
    INNER JOIN ${entities} ON ${entities.id} = ${bottles.brandId}
    WHERE ${bottles.searchVector} IS NOT NULL
      AND ${bottles.searchVector} @@ websearch_to_tsquery('english', ${queryText})
    ORDER BY score DESC, ${bottles.fullName} ASC
    LIMIT ${TEXT_CANDIDATE_LIMIT}
  `);

  return result.rows.map((row) => buildPriceMatchCandidate(row, "text"));
}

async function getReleaseTextCandidates(
  queryText: string,
): Promise<PriceMatchCandidate[]> {
  if (!queryText.trim()) {
    return [];
  }

  const result = await db.execute<{
    bottleId: number;
    releaseId: number;
    fullName: string;
    bottleFullName: string;
    brand: string | null;
    category: z.infer<typeof ExtractedBottleDetailsSchema>["category"] | null;
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
      ${bottleReleases.bottleId} AS "bottleId",
      ${bottleReleases.id} AS "releaseId",
      ${bottleReleases.fullName} AS "fullName",
      ${bottles.fullName} AS "bottleFullName",
      ${entities.name} AS brand,
      ${bottles.category} AS category,
      ${bottleReleases.statedAge} AS "statedAge",
      ${bottleReleases.edition} AS edition,
      ${bottleReleases.caskStrength} AS "caskStrength",
      ${bottleReleases.singleCask} AS "singleCask",
      ${bottleReleases.abv} AS abv,
      ${bottleReleases.vintageYear} AS "vintageYear",
      ${bottleReleases.releaseYear} AS "releaseYear",
      ${bottleReleases.caskType} AS "caskType",
      ${bottleReleases.caskSize} AS "caskSize",
      ${bottleReleases.caskFill} AS "caskFill",
      ts_rank(${bottleReleases.searchVector}, websearch_to_tsquery('english', ${queryText})) AS score
    FROM ${bottleReleases}
    INNER JOIN ${bottles} ON ${bottles.id} = ${bottleReleases.bottleId}
    INNER JOIN ${entities} ON ${entities.id} = ${bottles.brandId}
    WHERE ${bottleReleases.searchVector} IS NOT NULL
      AND ${bottleReleases.searchVector} @@ websearch_to_tsquery('english', ${queryText})
    ORDER BY score DESC, ${bottleReleases.fullName} ASC
    LIMIT ${TEXT_CANDIDATE_LIMIT}
  `);

  return result.rows.map((row) =>
    buildPriceMatchCandidate(row, "release_text"),
  );
}

async function getBrandCandidates(
  normalizedName: string,
  extractedLabel: ExtractedBottleDetails | null,
): Promise<PriceMatchCandidate[]> {
  if (!extractedLabel?.brand && !extractedLabel?.bottler) {
    return [];
  }

  const brandName = (extractedLabel.brand ?? extractedLabel.bottler)?.trim();
  if (!brandName) {
    return [];
  }
  const expression = extractedLabel.expression || normalizedName;

  const result = await db.execute<{
    bottleId: number;
    fullName: string;
    bottleFullName: string;
    brand: string | null;
    category: z.infer<typeof ExtractedBottleDetailsSchema>["category"] | null;
    statedAge: number | null;
    edition: string | null;
    caskStrength: boolean | null;
    singleCask: boolean | null;
    abv: number | null;
    vintageYear: number | null;
    releaseYear: number | null;
    caskType: string | null;
  }>(sql`
    SELECT
      ${bottles.id} AS "bottleId",
      ${bottles.fullName} AS "fullName",
      ${bottles.fullName} AS "bottleFullName",
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
    FROM ${bottles}
    INNER JOIN ${entities} ON ${entities.id} = ${bottles.brandId}
    WHERE (
      LOWER(${entities.name}) = LOWER(${brandName})
      OR LOWER(COALESCE(${entities.shortName}, '')) = LOWER(${brandName})
    )
      AND ${bottles.fullName} ILIKE ${`%${expression}%`}
    ORDER BY ${bottles.fullName} ASC
    LIMIT ${BRAND_CANDIDATE_LIMIT}
  `);

  return result.rows.map((row) => buildPriceMatchCandidate(row, "brand"));
}

export async function getBottleMatchCandidateById(
  bottleId: number,
  releaseId: number | null = null,
): Promise<PriceMatchCandidate | null> {
  const [result] = releaseId
    ? await db
        .select({
          bottleId: bottles.id,
          releaseId: bottleReleases.id,
          fullName: bottleReleases.fullName,
          bottleFullName: bottles.fullName,
          brand: entities.name,
          category: bottles.category,
          statedAge: bottleReleases.statedAge,
          edition: bottleReleases.edition,
          caskStrength: bottleReleases.caskStrength,
          singleCask: bottleReleases.singleCask,
          abv: bottleReleases.abv,
          vintageYear: bottleReleases.vintageYear,
          releaseYear: bottleReleases.releaseYear,
          caskType: bottleReleases.caskType,
          caskSize: bottleReleases.caskSize,
          caskFill: bottleReleases.caskFill,
        })
        .from(bottleReleases)
        .innerJoin(bottles, eq(bottles.id, bottleReleases.bottleId))
        .innerJoin(entities, eq(entities.id, bottles.brandId))
        .where(eq(bottleReleases.id, releaseId))
        .limit(1)
    : await db
        .select({
          bottleId: bottles.id,
          fullName: bottles.fullName,
          bottleFullName: bottles.fullName,
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
        .where(eq(bottles.id, bottleId))
        .limit(1);

  if (!result) {
    return null;
  }

  const candidate = buildPriceMatchCandidate(
    {
      bottleId: result.bottleId,
      releaseId: releaseId ?? null,
      fullName: result.fullName,
      bottleFullName: result.bottleFullName,
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

  return (await enrichPriceMatchCandidates([candidate], null))[0] ?? null;
}

async function getExactBottleCandidate(
  normalizedName: string,
): Promise<PriceMatchCandidate | null> {
  const [exactMatch] = await db
    .select({
      bottleId: bottleAliases.bottleId,
      releaseId: bottleAliases.releaseId,
      alias: bottleAliases.name,
      fullName: sql<string>`COALESCE(${bottleReleases.fullName}, ${bottles.fullName})`,
      bottleFullName: bottles.fullName,
      brand: entities.name,
      category: bottles.category,
      statedAge: sql<
        number | null
      >`COALESCE(${bottleReleases.statedAge}, ${bottles.statedAge})`,
      edition: sql<
        string | null
      >`COALESCE(${bottleReleases.edition}, ${bottles.edition})`,
      caskStrength: sql<
        boolean | null
      >`COALESCE(${bottleReleases.caskStrength}, ${bottles.caskStrength})`,
      singleCask: sql<
        boolean | null
      >`COALESCE(${bottleReleases.singleCask}, ${bottles.singleCask})`,
      abv: sql<number | null>`COALESCE(${bottleReleases.abv}, ${bottles.abv})`,
      vintageYear: sql<
        number | null
      >`COALESCE(${bottleReleases.vintageYear}, ${bottles.vintageYear})`,
      releaseYear: sql<
        number | null
      >`COALESCE(${bottleReleases.releaseYear}, ${bottles.releaseYear})`,
      caskType: sql<
        string | null
      >`COALESCE(${bottleReleases.caskType}, ${bottles.caskType})`,
      caskSize: sql<
        string | null
      >`COALESCE(${bottleReleases.caskSize}, ${bottles.caskSize})`,
      caskFill: sql<
        string | null
      >`COALESCE(${bottleReleases.caskFill}, ${bottles.caskFill})`,
    })
    .from(bottleAliases)
    .innerJoin(bottles, eq(bottles.id, bottleAliases.bottleId))
    .leftJoin(bottleReleases, eq(bottleReleases.id, bottleAliases.releaseId))
    .innerJoin(entities, eq(entities.id, bottles.brandId))
    .where(
      and(
        eq(sql`LOWER(${bottleAliases.name})`, normalizedName.toLowerCase()),
        eq(bottleAliases.ignored, false),
        isNotNull(bottleAliases.bottleId),
      ),
    )
    .limit(1);

  if (!exactMatch?.bottleId) {
    return null;
  }

  return buildPriceMatchCandidate(
    {
      bottleId: exactMatch.bottleId,
      releaseId: exactMatch.releaseId,
      alias: exactMatch.alias,
      fullName: exactMatch.fullName,
      bottleFullName: exactMatch.bottleFullName,
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

async function getExactBottleCandidateByNames(
  normalizedNames: string[],
): Promise<PriceMatchCandidate | null> {
  for (const normalizedName of normalizedNames) {
    const candidate = await getExactBottleCandidate(normalizedName);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

export async function findStorePriceMatchCandidates(
  price: Pick<StorePrice, "name" | "bottleId"> & { releaseId?: number | null },
  extractedLabel: ExtractedBottleDetails | null,
) {
  return await findBottleMatchCandidates({
    query: price.name,
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
    currentBottleId: price.bottleId ?? null,
    currentReleaseId: price.releaseId ?? null,
    limit: MATCH_CANDIDATE_LIMIT,
  });
}

export async function findBottleMatchCandidates(
  rawInput: BottleCandidateSearchInputRequest,
) {
  const input = BottleCandidateSearchInputSchema.parse(rawInput);
  const searchName = buildRawSearchName(input);
  if (!searchName) {
    return [];
  }

  const extractedLabel = buildSearchLabel(input);
  const normalizedName = getNormalizedPriceName(searchName);
  const exactSearchNames = Array.from(
    new Set(
      [normalizedName, input.query ? getNormalizedPriceName(input.query) : null]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase()),
    ),
  );
  const queryText = buildQueryText(normalizedName, extractedLabel);
  const candidates = new Map<string, PriceMatchCandidate>();

  const [
    currentCandidate,
    vectorCandidates,
    textCandidates,
    releaseTextCandidates,
    brandCandidates,
    exactCandidate,
  ] = await Promise.all([
    input.currentBottleId
      ? runCandidateLookupSafely(
          "current",
          searchName,
          null,
          async () =>
            await getBottleMatchCandidateById(
              input.currentBottleId!,
              input.currentReleaseId ?? null,
            ),
        )
      : Promise.resolve(null),
    runCandidateLookupSafely(
      "vector",
      searchName,
      [] as PriceMatchCandidate[],
      async () => await getVectorCandidates(queryText),
    ),
    runCandidateLookupSafely(
      "text",
      searchName,
      [] as PriceMatchCandidate[],
      async () => await getTextCandidates(queryText),
    ),
    runCandidateLookupSafely(
      "release_text",
      searchName,
      [] as PriceMatchCandidate[],
      async () => await getReleaseTextCandidates(queryText),
    ),
    runCandidateLookupSafely(
      "brand",
      searchName,
      [] as PriceMatchCandidate[],
      async () => await getBrandCandidates(normalizedName, extractedLabel),
    ),
    runCandidateLookupSafely(
      "exact",
      searchName,
      null as PriceMatchCandidate | null,
      async () => await getExactBottleCandidateByNames(exactSearchNames),
    ),
  ]);

  if (currentCandidate) {
    mergePriceMatchCandidate(candidates, currentCandidate);
  }
  for (const candidate of vectorCandidates) {
    mergePriceMatchCandidate(candidates, candidate);
  }
  for (const candidate of textCandidates) {
    mergePriceMatchCandidate(candidates, candidate);
  }
  for (const candidate of releaseTextCandidates) {
    mergePriceMatchCandidate(candidates, candidate);
  }
  for (const candidate of brandCandidates) {
    mergePriceMatchCandidate(candidates, candidate);
  }
  if (exactCandidate) {
    mergePriceMatchCandidate(candidates, exactCandidate);
  }

  const enrichedCandidates = await enrichPriceMatchCandidates(
    Array.from(candidates.values()),
    extractedLabel,
  );

  return filterCandidatesByKnownBrand(enrichedCandidates, extractedLabel)
    .sort(
      (a, b) =>
        getCandidateSortScore(b, extractedLabel) -
          getCandidateSortScore(a, extractedLabel) ||
        (b.score ?? 0) - (a.score ?? 0),
    )
    .slice(0, input.limit);
}
