import { bottles, bottlesToDistillers } from "@peated/server/db/schema";
import { asc, desc, inArray, sql, type SQL } from "drizzle-orm";

export type BottleProducerIds = {
  brandIds: readonly number[];
  bottlerIds: readonly number[];
  distillerIds: readonly number[];
};

export type BottleProducerReleaseFacts = {
  caskNumber?: string | null;
  statedAge?: number | null;
  vintageYear?: number | null;
  abv?: number | null;
};

/**
 * Bottle search owns this rule (bottle-search.md, "Retrieval"): every Bottle
 * candidate search reserves a window for Bottles of the known Brand, bottler,
 * or distillery. Otherwise popular unrelated Bottles fill the text limit and
 * hide a rare release of the right producer.
 */
export function bottleProducerWhere({
  brandIds,
  bottlerIds,
  distillerIds,
}: BottleProducerIds): SQL | undefined {
  const queries = [
    ...(brandIds.length
      ? [
          sql`SELECT ${bottles.id} FROM ${bottles}
        WHERE ${inArray(bottles.brandId, [...brandIds])}`,
        ]
      : []),
    ...(bottlerIds.length
      ? [
          sql`SELECT ${bottles.id} FROM ${bottles}
        WHERE ${inArray(bottles.bottlerId, [...bottlerIds])}`,
        ]
      : []),
    ...(distillerIds.length
      ? [
          sql`SELECT ${bottlesToDistillers.bottleId}
        FROM ${bottlesToDistillers}
        WHERE ${inArray(bottlesToDistillers.distillerId, [...distillerIds])}`,
        ]
      : []),
  ];
  return queries.length
    ? sql`${bottles.id} IN (${sql.join(queries, sql` UNION `)})`
    : undefined;
}

/** Within one producer, Bottles that share the most release facts come first. */
export function bottleProducerOrder(facts: BottleProducerReleaseFacts): SQL[] {
  const factScore = sql`(
    CASE WHEN ${bottles.caskNumber} = ${facts.caskNumber ?? null} THEN 8 ELSE 0 END +
    CASE WHEN ${bottles.statedAge} = ${facts.statedAge ?? null} THEN 2 ELSE 0 END +
    CASE WHEN ${bottles.vintageYear} = ${facts.vintageYear ?? null} THEN 3 ELSE 0 END +
    CASE WHEN ${bottles.abv} = ${facts.abv ?? null} THEN 2 ELSE 0 END
  )`;
  return [desc(factScore), desc(bottles.totalTastings), asc(bottles.id)];
}
