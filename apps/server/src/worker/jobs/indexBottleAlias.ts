import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottles,
  bottleTombstones,
  entities,
} from "@peated/server/db/schema";
import { formatCategoryName } from "@peated/server/lib/format";
import { logInfo } from "@peated/server/lib/log";
import { getOpenAIEmbedding } from "@peated/server/lib/openaiEmbeddings";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { JobPayload } from "../types";

const CASK_STRENGTH_SEARCH_TERMS =
  "cask strength barrel strength barrel proof full proof natural strength";
const SINGLE_CASK_SEARCH_TERMS = "single cask single barrel";
const MAX_SEARCH_SOURCE_ATTEMPTS = 2;

export const IndexBottleAliasJobArgsSchema = z
  .object({
    name: z.string().min(1),
  })
  .strict();

type BottleAliasSearchSource = {
  alias: {
    name: string;
    bottleId: number;
    ignored: boolean | null;
    hasEmbedding: boolean;
  };
  bottle: Pick<
    typeof bottles.$inferSelect,
    | "id"
    | "groupId"
    | "brandId"
    | "category"
    | "edition"
    | "statedAge"
    | "maturation"
    | "caskNumber"
    | "caskStrength"
    | "singleCask"
    | "vintageYear"
    | "releaseYear"
    | "abv"
  >;
  brand: Pick<typeof entities.$inferSelect, "id" | "name" | "shortName">;
};

function formatSearchAbv(abv: number | null | undefined) {
  if (abv === null || abv === undefined) {
    return null;
  }

  return `${abv.toFixed(1)}% ABV`;
}

function aliasSnapshotWhere(alias: {
  name: string;
  bottleId: number | null;
  ignored: boolean | null;
}) {
  return and(
    eq(sql`LOWER(${bottleAliases.name})`, alias.name.toLowerCase()),
    sql`${bottleAliases.bottleId} IS NOT DISTINCT FROM ${alias.bottleId}`,
    sql`${bottleAliases.ignored} IS NOT DISTINCT FROM ${alias.ignored}`,
  );
}

function bottleSearchSourceWhere(source: BottleAliasSearchSource) {
  return sql`EXISTS (
    SELECT 1
    FROM ${bottles}
    INNER JOIN ${entities}
      ON ${entities.id} = ${bottles.brandId}
    LEFT JOIN ${bottleTombstones}
      ON ${bottleTombstones.bottleId} = ${bottles.id}
    WHERE ${bottles.id} = ${source.bottle.id}
      AND ${bottles.groupId} IS NOT DISTINCT FROM ${source.bottle.groupId}
      AND ${bottles.brandId} IS NOT DISTINCT FROM ${source.bottle.brandId}
      AND ${bottles.category} IS NOT DISTINCT FROM ${source.bottle.category}
      AND ${bottles.edition} IS NOT DISTINCT FROM ${source.bottle.edition}
      AND ${bottles.statedAge} IS NOT DISTINCT FROM ${source.bottle.statedAge}
      AND ${bottles.maturation} IS NOT DISTINCT FROM ${source.bottle.maturation}
      AND ${bottles.caskNumber} IS NOT DISTINCT FROM ${source.bottle.caskNumber}
      AND ${bottles.caskStrength} IS NOT DISTINCT FROM ${source.bottle.caskStrength}
      AND ${bottles.singleCask} IS NOT DISTINCT FROM ${source.bottle.singleCask}
      AND ${bottles.vintageYear} IS NOT DISTINCT FROM ${source.bottle.vintageYear}
      AND ${bottles.releaseYear} IS NOT DISTINCT FROM ${source.bottle.releaseYear}
      AND ${bottles.abv} IS NOT DISTINCT FROM ${source.bottle.abv}
      AND ${entities.id} = ${source.brand.id}
      AND ${entities.name} IS NOT DISTINCT FROM ${source.brand.name}
      AND ${entities.shortName} IS NOT DISTINCT FROM ${source.brand.shortName}
      AND ${bottles.groupId} IS NOT NULL
      AND ${bottleTombstones.bottleId} IS NULL
  )`;
}

async function clearAliasEmbedding(alias: {
  name: string;
  bottleId: number | null;
  ignored: boolean | null;
}) {
  await db
    .update(bottleAliases)
    .set({ embedding: null })
    .where(aliasSnapshotWhere(alias));
}

async function clearActiveSourceEmbedding(
  source: BottleAliasSearchSource,
  { requireEmptyEmbedding }: { requireEmptyEmbedding: boolean },
) {
  const cleared = await db
    .update(bottleAliases)
    .set({ embedding: null })
    .where(
      and(
        aliasSnapshotWhere(source.alias),
        bottleSearchSourceWhere(source),
        requireEmptyEmbedding ? isNull(bottleAliases.embedding) : undefined,
      ),
    )
    .returning({ name: bottleAliases.name });

  return cleared.length > 0;
}

async function loadActiveBottleAliasSearchSource(
  name: string,
): Promise<BottleAliasSearchSource | null> {
  const [alias] = await db
    .select({
      name: bottleAliases.name,
      bottleId: bottleAliases.bottleId,
      ignored: bottleAliases.ignored,
      hasEmbedding: sql<boolean>`${bottleAliases.embedding} IS NOT NULL`,
    })
    .from(bottleAliases)
    .where(eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()))
    .limit(1);
  if (!alias) {
    throw new Error(`Unknown bottle alias: ${name}`);
  }

  if (alias.ignored || alias.bottleId === null) {
    await clearAliasEmbedding(alias);
    return null;
  }

  const [resolved] = await db
    .select({
      bottle: {
        id: bottles.id,
        groupId: bottles.groupId,
        brandId: bottles.brandId,
        category: bottles.category,
        edition: bottles.edition,
        statedAge: bottles.statedAge,
        maturation: bottles.maturation,
        caskNumber: bottles.caskNumber,
        caskStrength: bottles.caskStrength,
        singleCask: bottles.singleCask,
        vintageYear: bottles.vintageYear,
        releaseYear: bottles.releaseYear,
        abv: bottles.abv,
      },
      brand: {
        id: entities.id,
        name: entities.name,
        shortName: entities.shortName,
      },
    })
    .from(bottles)
    .innerJoin(entities, eq(entities.id, bottles.brandId))
    .leftJoin(bottleTombstones, eq(bottleTombstones.bottleId, bottles.id))
    .where(
      and(
        eq(bottles.id, alias.bottleId),
        isNotNull(bottles.groupId),
        isNull(bottleTombstones.bottleId),
      ),
    )
    .limit(1);

  if (!resolved) {
    await clearAliasEmbedding(alias);
    return null;
  }

  return {
    alias: {
      name: alias.name,
      bottleId: alias.bottleId,
      ignored: alias.ignored,
      hasEmbedding: alias.hasEmbedding,
    },
    ...resolved,
  };
}

function buildBottleAliasSearchText({
  alias,
  bottle,
  brand,
}: BottleAliasSearchSource) {
  const bits: string[] = [alias.name];
  if (bottle.category) bits.push(formatCategoryName(bottle.category));
  if (bottle.edition) bits.push(bottle.edition);
  if (bottle.statedAge) bits.push(`${bottle.statedAge}-year-old`);
  if (bottle.maturation) bits.push(bottle.maturation);
  if (bottle.caskNumber) bits.push(bottle.caskNumber);
  if (bottle.caskStrength) bits.push(CASK_STRENGTH_SEARCH_TERMS);
  if (bottle.singleCask) bits.push(SINGLE_CASK_SEARCH_TERMS);
  if (bottle.vintageYear) bits.push(`${bottle.vintageYear} vintage`);
  if (bottle.releaseYear) bits.push(`${bottle.releaseYear} release`);
  if (bottle.abv) bits.push(formatSearchAbv(bottle.abv)!);
  // shortName is already present in alias.name
  if (brand.name !== brand.shortName) bits.unshift(brand.name);
  return bits.join(" ");
}

export type IndexBottleAliasServices = {
  createEmbedding: (text: string) => Promise<number[]>;
};

const defaultServices: IndexBottleAliasServices = {
  createEmbedding: getOpenAIEmbedding,
};

export async function indexBottleAlias(
  input: JobPayload,
  services: IndexBottleAliasServices = defaultServices,
) {
  const { name } = IndexBottleAliasJobArgsSchema.parse(input);

  logInfo("Updating index for bottle alias {name}", {
    extra: {
      name,
    },
  });

  let clearedSource = false;
  for (let attempt = 0; attempt < MAX_SEARCH_SOURCE_ATTEMPTS; attempt += 1) {
    const source = await loadActiveBottleAliasSearchSource(name);
    if (!source) return;

    if (clearedSource && source.alias.hasEmbedding) {
      return;
    }

    const cleared = await clearActiveSourceEmbedding(source, {
      requireEmptyEmbedding: clearedSource,
    });
    if (!cleared) {
      if (clearedSource) {
        const reloadedSource = await loadActiveBottleAliasSearchSource(name);
        if (!reloadedSource || reloadedSource.alias.hasEmbedding) {
          return;
        }
      }
      continue;
    }
    clearedSource = true;

    const embedding = await services.createEmbedding(
      buildBottleAliasSearchText(source),
    );
    const updated = await db
      .update(bottleAliases)
      .set({ embedding })
      .where(
        and(aliasSnapshotWhere(source.alias), bottleSearchSourceWhere(source)),
      )
      .returning({ name: bottleAliases.name });
    if (updated.length) return;
  }

  throw new Error(
    `Bottle alias search source changed repeatedly while indexing: ${name}`,
  );
}

export default async function indexBottleAliasJob(input: JobPayload) {
  return await indexBottleAlias(input);
}
