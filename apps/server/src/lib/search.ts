import type { NewBottle, NewBottleSeries, NewEntity } from "../db/schema";
import { formatCategoryName } from "./format";

const CASK_STRENGTH_SEARCH_TERMS =
  "cask strength barrel strength barrel proof full proof natural strength";
const SINGLE_CASK_SEARCH_TERMS = "single cask single barrel";

function formatSearchAbv(abv: number | null | undefined) {
  if (abv === null || abv === undefined) {
    return null;
  }

  return `${Number.isInteger(abv) ? abv.toFixed(1) : abv}% ABV`;
}

function joinUniqueValues(values: string[]) {
  return [...new Set(values)].join("\n");
}

/** Entity documents hold the name, short name, references, and aliases. */
export function buildEntitySearchDocument(
  entity: NewEntity,
  alternateNames?: { name: string }[],
) {
  const names = [
    entity.name,
    ...(entity.shortName ? [entity.shortName] : []),
    ...(alternateNames ?? [])
      .filter(({ name }) => name !== entity.name)
      .map(({ name }) => name),
  ];
  return { searchNames: joinUniqueValues(names) };
}

/**
 * `searchNames` holds what identifies the Bottle: names, edition, cask code,
 * Series, and accepted aliases. `searchTerms` adds producers and release facts.
 */
export function buildBottleSearchDocuments(
  bottle: NewBottle,
  brand: NewEntity,
  nameList?: { name: string }[],
  bottler?: NewEntity,
  distillerList?: NewEntity[],
  series?: NewBottleSeries,
) {
  const names = [bottle.fullName];
  const terms = [brand.name];
  if (brand.shortName) terms.push(`${brand.shortName} ${bottle.name}`);
  if (bottle.category) terms.push(formatCategoryName(bottle.category));
  if (bottle.edition) names.push(bottle.edition);
  if (bottle.statedAge) terms.push(`${bottle.statedAge}-year-old`);
  if (bottle.maturation) terms.push(bottle.maturation);
  if (bottle.caskNumber) names.push(bottle.caskNumber);
  if (bottle.caskStrength) terms.push(CASK_STRENGTH_SEARCH_TERMS);
  if (bottle.singleCask) terms.push(SINGLE_CASK_SEARCH_TERMS);
  if (bottle.vintageYear) terms.push(`${bottle.vintageYear} vintage`);
  if (bottle.releaseYear) terms.push(`${bottle.releaseYear} release`);
  if (bottle.abv) terms.push(formatSearchAbv(bottle.abv)!);
  if (bottler) terms.push(bottler.name);
  if (series) names.push(series.name);
  nameList
    ?.filter((a) => a.name !== bottle.fullName)
    .forEach((a) => names.push(a.name));
  distillerList?.forEach((a) => terms.push(a.name));
  return {
    searchNames: joinUniqueValues(names),
    searchTerms: joinUniqueValues([...names, ...terms]),
  };
}

/** Series documents hold the full name and the Brand names. */
export function buildBottleSeriesSearchDocument(
  series: NewBottleSeries,
  brand: NewEntity,
) {
  const names = [series.fullName, brand.name];
  if (brand.shortName) names.push(`${brand.shortName} ${series.name}`);
  return { searchNames: joinUniqueValues(names) };
}
