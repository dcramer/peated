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
import { normalizeBottle } from "@peated/server/lib/normalize";
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
  score?: number | string | null;
};

export const BottleCandidateSearchInputSchema = z.object({
  query: z.string().trim().nullable().default(null),
  brand: z.string().trim().nullable().default(null),
  expression: z.string().trim().nullable().default(null),
  series: z.string().trim().nullable().default(null),
  distillery: z.array(z.string().trim()).default([]),
  category: z.enum(CATEGORY_LIST).nullable().default(null),
  stated_age: z.number().nullable().default(null),
  cask_type: z.string().trim().nullable().default(null),
  cask_strength: z.boolean().nullable().default(null),
  single_cask: z.boolean().nullable().default(null),
  edition: z.string().trim().nullable().default(null),
  currentBottleId: z.number().nullable().default(null),
  limit: z.number().int().min(1).max(25).default(MATCH_CANDIDATE_LIMIT),
});

type BottleCandidateSearchInput = z.infer<
  typeof BottleCandidateSearchInputSchema
>;

function getNormalizedPriceName(name: string) {
  return normalizeBottle({
    name,
    isFullName: true,
  }).name;
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
    !input.cask_type &&
    input.cask_strength === null &&
    input.single_cask === null &&
    !input.edition
  ) {
    return null;
  }

  return ExtractedBottleDetailsSchema.parse({
    brand: input.brand,
    expression: input.expression,
    series: input.series,
    distillery: input.distillery,
    category: input.category,
    stated_age: input.stated_age,
    abv: null,
    release_year: null,
    vintage_year: null,
    cask_type: input.cask_type,
    cask_strength: input.cask_strength,
    single_cask: input.single_cask,
    edition: input.edition,
  });
}

function buildRawSearchName(input: BottleCandidateSearchInput) {
  const parts = [
    input.query,
    input.brand,
    input.expression,
    input.series,
    input.edition,
    input.stated_age ? `${input.stated_age}` : null,
    input.cask_type,
    input.distillery.length ? input.distillery.join(" ") : null,
  ];

  return parts.filter(Boolean).join(" ").trim();
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
    score: row.score === undefined || row.score === null ? null : Number(row.score),
    source: [source],
  });
}

export async function extractStorePriceBottleDetails(
  price: Pick<StorePrice, "name" | "imageUrl">,
): Promise<ExtractedBottleDetails | null> {
  try {
    if (price.imageUrl) {
      return ExtractedBottleDetailsSchema.parse(
        await extractFromImage(absoluteUrl(config.API_SERVER, price.imageUrl)),
      );
    }
    return ExtractedBottleDetailsSchema.parse(
      await extractFromText(price.name),
    );
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
  if (extractedLabel?.cask_type) parts.push(extractedLabel.cask_type);
  if (extractedLabel?.cask_strength) parts.push("cask strength");
  if (extractedLabel?.single_cask) parts.push("single cask");
  if (extractedLabel?.distillery?.length)
    parts.push(extractedLabel.distillery.join(" "));

  return Array.from(new Set(parts.filter(Boolean))).join(" ");
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
    score: number | null;
  }>(sql`
    SELECT
      ${bottleAliases.bottleId} AS "bottleId",
      ${bottleAliases.name} AS alias,
      ${bottles.fullName} AS "fullName",
      ${entities.name} AS brand,
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

  return result.rows.map((row) =>
    buildPriceMatchCandidate(row, "vector"),
  );
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
    score: number | null;
  }>(sql`
    SELECT
      ${bottles.id} AS "bottleId",
      ${bottles.fullName} AS "fullName",
      ${entities.name} AS brand,
      ts_rank(${bottles.searchVector}, websearch_to_tsquery('english', ${queryText})) AS score
    FROM ${bottles}
    INNER JOIN ${entities} ON ${entities.id} = ${bottles.brandId}
    WHERE ${bottles.searchVector} IS NOT NULL
      AND ${bottles.searchVector} @@ websearch_to_tsquery('english', ${queryText})
    ORDER BY score DESC, ${bottles.fullName} ASC
    LIMIT ${TEXT_CANDIDATE_LIMIT}
  `);

  return result.rows.map((row) =>
    buildPriceMatchCandidate(row, "text"),
  );
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
  }>(sql`
    SELECT
      ${bottles.id} AS "bottleId",
      ${bottles.fullName} AS "fullName",
      ${entities.name} AS brand
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

  return result.rows.map((row) =>
    buildPriceMatchCandidate(row, "brand"),
  );
}

export async function getBottleMatchCandidateById(
  bottleId: number,
): Promise<PriceMatchCandidate | null> {
  const [result] = await db
    .select({
      bottleId: bottles.id,
      fullName: bottles.fullName,
      brand: entities.name,
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
    category: extractedLabel?.category ?? null,
    stated_age: extractedLabel?.stated_age ?? null,
    cask_type: extractedLabel?.cask_type ?? null,
    cask_strength: extractedLabel?.cask_strength ?? null,
    single_cask: extractedLabel?.single_cask ?? null,
    edition: extractedLabel?.edition ?? null,
    currentBottleId: price.bottleId ?? null,
    limit: MATCH_CANDIDATE_LIMIT,
  });
}

export async function findBottleMatchCandidates(
  rawInput: BottleCandidateSearchInput,
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

  return Array.from(candidates.values())
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, input.limit);
}
