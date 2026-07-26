import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroupTombstones,
  bottles,
  bottleTombstones,
  entities,
} from "@peated/server/db/schema";
import { formatCategoryName } from "@peated/server/lib/format";
import { logInfo } from "@peated/server/lib/log";
import { getOpenAIEmbedding } from "@peated/server/lib/openaiEmbeddings";
import { and, eq, getTableColumns, isNull, sql } from "drizzle-orm";

const CASK_STRENGTH_SEARCH_TERMS =
  "cask strength barrel strength barrel proof full proof natural strength";
const SINGLE_CASK_SEARCH_TERMS = "single cask single barrel";

function formatSearchAbv(abv: number | null | undefined) {
  if (abv === null || abv === undefined) {
    return null;
  }

  return `${abv.toFixed(1)}% ABV`;
}

function formatSearchEnum(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.replace(/_/g, " ");
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

function activeBottleWhere(bottleId: number) {
  return sql`EXISTS (
    SELECT 1
    FROM ${bottles}
    LEFT JOIN ${bottleTombstones}
      ON ${bottleTombstones.bottleId} = ${bottles.id}
    LEFT JOIN ${bottleGroupTombstones}
      ON ${bottleGroupTombstones.groupId} = ${bottles.groupId}
    WHERE ${bottles.id} = ${bottleId}
      AND ${bottleTombstones.bottleId} IS NULL
      AND ${bottleGroupTombstones.groupId} IS NULL
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

export default async ({ name }: { name: string }) => {
  const alias = await db.query.bottleAliases.findFirst({
    where: (bottleAliases, { eq }) =>
      eq(sql`LOWER(${bottleAliases.name})`, name.toLowerCase()),
  });
  if (!alias) {
    throw new Error(`Unknown bottle alias: ${name}`);
  }

  logInfo("Updating index for bottle alias {name}", {
    extra: {
      name,
    },
  });

  if (alias.ignored || alias.bottleId === null) {
    await clearAliasEmbedding(alias);
    return;
  }

  const [resolved] = await db
    .select({
      bottle: getTableColumns(bottles),
      brand: getTableColumns(entities),
    })
    .from(bottles)
    .innerJoin(entities, eq(entities.id, bottles.brandId))
    .leftJoin(bottleTombstones, eq(bottleTombstones.bottleId, bottles.id))
    .leftJoin(
      bottleGroupTombstones,
      eq(bottleGroupTombstones.groupId, bottles.groupId),
    )
    .where(
      and(
        eq(bottles.id, alias.bottleId),
        isNull(bottleTombstones.bottleId),
        isNull(bottleGroupTombstones.groupId),
      ),
    )
    .limit(1);

  if (!resolved) {
    await clearAliasEmbedding(alias);
    return;
  }

  const { bottle, brand } = resolved;
  const bits: string[] = [alias.name];
  if (bottle.category) bits.push(formatCategoryName(bottle.category));
  if (bottle.edition) bits.push(bottle.edition);
  if (bottle.statedAge) bits.push(`${bottle.statedAge}-year-old`);
  if (bottle.caskType) bits.push(formatSearchEnum(bottle.caskType)!);
  if (bottle.caskStrength) bits.push(CASK_STRENGTH_SEARCH_TERMS);
  if (bottle.singleCask) bits.push(SINGLE_CASK_SEARCH_TERMS);
  if (bottle.vintageYear) bits.push(`${bottle.vintageYear} vintage`);
  if (bottle.releaseYear) bits.push(`${bottle.releaseYear} release`);
  if (bottle.abv) bits.push(formatSearchAbv(bottle.abv)!);
  // shortName is already present in alias.name
  if (brand.name !== brand.shortName) bits.unshift(brand.name);
  const embedding = await getOpenAIEmbedding(bits.join(" "));

  // Revalidate direct ownership after the external call so stale queued work cannot write.
  const updated = await db
    .update(bottleAliases)
    .set({
      embedding,
    })
    .where(and(aliasSnapshotWhere(alias), activeBottleWhere(alias.bottleId)))
    .returning({ name: bottleAliases.name });

  if (!updated.length) {
    await clearAliasEmbedding(alias);
  }
};
