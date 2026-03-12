import {
  extractFromImage,
  extractFromText,
} from "@peated/server/agents/whisky/labelExtractor";
import config from "@peated/server/config";
import { CATEGORY_LIST } from "@peated/server/constants";
import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  entities,
  type StorePrice,
} from "@peated/server/db/schema";
import { logError } from "@peated/server/lib/log";
import { normalizeBottle, normalizeString } from "@peated/server/lib/normalize";
import { absoluteUrl } from "@peated/server/lib/urls";
import {
  ExtractedBottleDetailsSchema,
  PriceMatchCandidateSchema,
} from "@peated/server/schemas";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getOpenAIEmbedding } from "./openaiEmbeddings";

const VECTOR_CANDIDATE_LIMIT = 20;
const TEXT_CANDIDATE_LIMIT = 10;
const BRAND_CANDIDATE_LIMIT = 5;
const MATCH_CANDIDATE_LIMIT = 15;

type ExtractedBottleDetails = z.infer<typeof ExtractedBottleDetailsSchema>;
type PriceMatchCandidate = z.infer<typeof PriceMatchCandidateSchema>;
type RawPriceMatchCandidateRow = {
  bottleId: number | string;
  alias?: string | null;
  fullName: string;
  brand?: string | null;
  category?: z.infer<typeof ExtractedBottleDetailsSchema>["category"] | null;
  statedAge?: number | string | null;
  edition?: string | null;
  caskStrength?: boolean | null;
  singleCask?: boolean | null;
  abv?: number | string | null;
  vintageYear?: number | string | null;
  releaseYear?: number | string | null;
  caskType?: string | null;
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
  expression: z.string().trim().nullable().default(null),
  series: z.string().trim().nullable().default(null),
  distillery: z.array(z.string().trim()).default([]),
  category: z.enum(CATEGORY_LIST).nullable().default(null),
  stated_age: z.number().nullable().default(null),
  abv: z.number().min(0).max(100).nullable().default(null),
  cask_type: z.string().trim().nullable().default(null),
  cask_strength: z.boolean().nullable().default(null),
  single_cask: z.boolean().nullable().default(null),
  edition: z.string().trim().nullable().default(null),
  vintage_year: z.number().int().nullable().default(null),
  release_year: z.number().int().nullable().default(null),
  currentBottleId: z.number().nullable().default(null),
  limit: z.number().int().min(1).max(25).default(MATCH_CANDIDATE_LIMIT),
});

type BottleCandidateSearchInput = z.infer<
  typeof BottleCandidateSearchInputSchema
>;
type BottleCandidateSearchInputRequest = z.input<
  typeof BottleCandidateSearchInputSchema
>;

const CANDIDATE_METADATA_FIELDS = [
  "category",
  "statedAge",
  "edition",
  "caskStrength",
  "singleCask",
  "abv",
  "vintageYear",
  "releaseYear",
  "caskType",
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
    !input.expression &&
    !input.series &&
    !input.distillery.length &&
    !input.category &&
    !input.stated_age &&
    input.abv === null &&
    !input.cask_type &&
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
    expression: input.expression,
    series: input.series,
    distillery: input.distillery,
    category: normalizeMatchCategory(input.category),
    stated_age: input.stated_age,
    abv: input.abv,
    release_year: input.release_year,
    vintage_year: input.vintage_year,
    cask_type: input.cask_type,
    cask_strength: input.cask_strength,
    single_cask: input.single_cask,
    edition: input.edition,
  });
}

function buildRawSearchName(input: BottleCandidateSearchInput) {
  const structuredParts = [
    input.brand,
    input.expression,
    input.series,
    input.edition,
    input.stated_age ? `${input.stated_age}` : null,
    formatSearchAbv(input.abv),
    input.cask_type,
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

function mergeCandidate(
  candidates: Map<number, PriceMatchCandidate>,
  candidate: PriceMatchCandidate,
) {
  const existing = candidates.get(candidate.bottleId);
  if (!existing) {
    candidates.set(candidate.bottleId, candidate);
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
    bottleId: Number(row.bottleId),
    alias: row.alias ?? null,
    fullName: row.fullName,
    brand: row.brand ?? null,
    category: row.category ?? null,
    statedAge: parseNullableNumber(row.statedAge),
    edition: row.edition ?? null,
    caskStrength: row.caskStrength ?? null,
    singleCask: row.singleCask ?? null,
    abv: parseNullableNumber(row.abv),
    vintageYear: parseNullableNumber(row.vintageYear),
    releaseYear: parseNullableNumber(row.releaseYear),
    caskType: row.caskType ?? null,
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
  if (extractedLabel?.expression) parts.push(extractedLabel.expression);
  if (extractedLabel?.series) parts.push(extractedLabel.series);
  if (extractedLabel?.edition) parts.push(extractedLabel.edition);
  if (extractedLabel?.category) parts.push(extractedLabel.category);
  if (extractedLabel?.stated_age)
    parts.push(`${extractedLabel.stated_age}-year-old`);
  if (extractedLabel?.abv !== null && extractedLabel?.abv !== undefined)
    parts.push(formatSearchAbv(extractedLabel.abv)!);
  if (extractedLabel?.cask_type) parts.push(extractedLabel.cask_type);
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

function getStructuredCandidateAdjustment(
  candidate: PriceMatchCandidate,
  extractedLabel: ExtractedBottleDetails | null,
) {
  if (!extractedLabel) {
    return 0;
  }

  let adjustment = 0;

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
  return (
    (candidate.score ?? 0) +
    getStructuredCandidateAdjustment(candidate, extractedLabel)
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
    alias: string | null;
    fullName: string;
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
      1 - (${bottleAliases.embedding} <=> ${vector}) AS score
    FROM ${bottleAliases}
    INNER JOIN ${bottles} ON ${bottles.id} = ${bottleAliases.bottleId}
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

async function getBrandCandidates(
  normalizedName: string,
  extractedLabel: ExtractedBottleDetails | null,
): Promise<PriceMatchCandidate[]> {
  if (!extractedLabel?.brand) {
    return [];
  }

  const brandName = extractedLabel.brand.trim();
  const expression = extractedLabel.expression || normalizedName;

  const result = await db.execute<{
    bottleId: number;
    fullName: string;
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
): Promise<PriceMatchCandidate | null> {
  const [result] = await db
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
    })
    .from(bottles)
    .innerJoin(entities, eq(entities.id, bottles.brandId))
    .where(eq(bottles.id, bottleId))
    .limit(1);

  if (!result) {
    return null;
  }

  return buildPriceMatchCandidate(
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
      score: 1,
    },
    "current",
  );
}

async function getExactBottleCandidate(
  normalizedName: string,
): Promise<PriceMatchCandidate | null> {
  const [exactMatch] = await db
    .select({
      bottleId: bottleAliases.bottleId,
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
    })
    .from(bottleAliases)
    .innerJoin(bottles, eq(bottles.id, bottleAliases.bottleId))
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
      score: 1,
    },
    "exact",
  );
}

export async function findStorePriceMatchCandidates(
  price: Pick<StorePrice, "name" | "bottleId">,
  extractedLabel: ExtractedBottleDetails | null,
) {
  return await findBottleMatchCandidates({
    query: price.name,
    brand: extractedLabel?.brand ?? null,
    expression: extractedLabel?.expression ?? null,
    series: extractedLabel?.series ?? null,
    distillery: extractedLabel?.distillery ?? [],
    category: normalizeMatchCategory(extractedLabel?.category ?? null),
    stated_age: extractedLabel?.stated_age ?? null,
    abv: extractedLabel?.abv ?? null,
    cask_type: extractedLabel?.cask_type ?? null,
    cask_strength: extractedLabel?.cask_strength ?? null,
    single_cask: extractedLabel?.single_cask ?? null,
    edition: extractedLabel?.edition ?? null,
    vintage_year: extractedLabel?.vintage_year ?? null,
    release_year: extractedLabel?.release_year ?? null,
    currentBottleId: price.bottleId ?? null,
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
  const queryText = buildQueryText(normalizedName, extractedLabel);
  const candidates = new Map<number, PriceMatchCandidate>();

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
          async () => await getBottleMatchCandidateById(input.currentBottleId!),
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
      "brand",
      searchName,
      [] as PriceMatchCandidate[],
      async () => await getBrandCandidates(normalizedName, extractedLabel),
    ),
    runCandidateLookupSafely(
      "exact",
      searchName,
      null as PriceMatchCandidate | null,
      async () => await getExactBottleCandidate(normalizedName),
    ),
  ]);

  if (currentCandidate) {
    mergeCandidate(candidates, currentCandidate);
  }
  for (const candidate of vectorCandidates) {
    mergeCandidate(candidates, candidate);
  }
  for (const candidate of textCandidates) {
    mergeCandidate(candidates, candidate);
  }
  for (const candidate of brandCandidates) {
    mergeCandidate(candidates, candidate);
  }
  if (exactCandidate) {
    mergeCandidate(candidates, exactCandidate);
  }

  return filterCandidatesByKnownBrand(
    Array.from(candidates.values()),
    extractedLabel,
  )
    .sort(
      (a, b) =>
        getCandidateSortScore(b, extractedLabel) -
          getCandidateSortScore(a, extractedLabel) ||
        (b.score ?? 0) - (a.score ?? 0),
    )
    .slice(0, input.limit);
}
