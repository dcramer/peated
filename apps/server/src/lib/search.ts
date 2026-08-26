import { sql } from "drizzle-orm";
import { TSVector } from "../db/columns";
import type {
  NewBottle,
  NewBottleAlias,
  NewBottleSeries,
  NewEntity,
} from "../db/schema";
import { formatCategoryName } from "./format";

const CASK_STRENGTH_SEARCH_TERMS =
  "cask strength barrel strength barrel proof full proof natural strength";
const SINGLE_CASK_SEARCH_TERMS = "single cask single barrel";

/** Parse human search text as normalized words, never as search operators. */
export function plainTextSearchQuery(query: string) {
  return sql`plainto_tsquery('english', unaccent(${query}))`;
}

/** Build prefix operators only from lexemes parsed by PostgreSQL. */
export function prefixTextSearchQuery(query: string) {
  return sql`COALESCE(
    to_tsquery(
      'english',
      (
        SELECT string_agg(quote_literal(token) || ':*', ' & ')
        FROM unnest(
          tsvector_to_array(to_tsvector('english', unaccent(${query})))
        ) AS token
      )
    ),
    ''::tsquery
  )`;
}

export function webSearchQuery(query: string) {
  return sql`websearch_to_tsquery('english', unaccent(${query}))`;
}

function formatSearchAbv(abv: number | null | undefined) {
  if (abv === null || abv === undefined) {
    return null;
  }

  return `${abv.toFixed(1)}% ABV`;
}

export function buildEntitySearchVector(
  entity: NewEntity,
  aliasList?: { name: string }[],
): TSVector[] {
  const values: TSVector[] = [
    new TSVector(entity.name, "A"),
    ...(entity.shortName ? [new TSVector(entity.shortName, "A")] : []),
  ];
  aliasList
    ?.filter((a) => a.name !== entity.name)
    .forEach((a) => values.push(new TSVector(a.name, "B")));
  return values;
}

export function buildBottleSearchVector(
  bottle: NewBottle,
  brand: NewEntity,
  aliasList?: Pick<NewBottleAlias, "name">[],
  bottler?: NewEntity,
  distillerList?: NewEntity[],
  series?: NewBottleSeries,
): TSVector[] {
  const values: TSVector[] = [
    new TSVector(bottle.fullName, "A"),
    new TSVector(brand.name, "B"),
  ];
  if (brand.shortName)
    values.push(new TSVector(`${brand.shortName} ${bottle.name}`, "B"));

  if (bottle.category)
    values.push(new TSVector(formatCategoryName(bottle.category), "C"));
  if (bottle.edition) values.push(new TSVector(bottle.edition, "A"));
  if (bottle.statedAge)
    values.push(new TSVector(`${bottle.statedAge}-year-old`, "B"));
  if (bottle.maturation) values.push(new TSVector(bottle.maturation, "B"));
  if (bottle.caskNumber) values.push(new TSVector(bottle.caskNumber, "A"));
  if (bottle.caskStrength)
    values.push(new TSVector(CASK_STRENGTH_SEARCH_TERMS, "B"));
  if (bottle.singleCask)
    values.push(new TSVector(SINGLE_CASK_SEARCH_TERMS, "B"));
  if (bottle.vintageYear)
    values.push(new TSVector(`${bottle.vintageYear} vintage`, "B"));
  if (bottle.releaseYear)
    values.push(new TSVector(`${bottle.releaseYear} release`, "B"));
  if (bottle.abv) values.push(new TSVector(formatSearchAbv(bottle.abv)!, "B"));
  if (bottler) values.push(new TSVector(bottler.name, "C"));
  if (series) values.push(new TSVector(series.name, "A"));
  aliasList
    ?.filter((a) => a.name !== bottle.fullName)
    .forEach((a) => values.push(new TSVector(a.name, "A")));
  distillerList?.forEach((a) => values.push(new TSVector(a.name, "B")));
  return values;
}

export function buildBottleSeriesSearchVector(
  series: NewBottleSeries,
  brand: NewEntity,
): TSVector[] {
  const values: TSVector[] = [
    new TSVector(series.fullName, "A"),
    new TSVector(brand.name, "C"),
  ];
  if (brand.shortName)
    values.push(new TSVector(`${brand.shortName} ${series.name}`, "B"));
  return values;
}
