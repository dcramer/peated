import {
  formatAbv,
  isBatchEdition,
} from "@peated/server/lib/bottleDisplayName";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Bottle } from "@peated/server/types";
import type {
  KeyFact,
  KeyFactList,
} from "@peated/web/components/catalogDetails.stylex";

type BottleHeaderSpecs = Pick<
  Bottle,
  | "abv"
  | "bottlingYear"
  | "caskNumber"
  | "category"
  | "edition"
  | "noAgeStatement"
  | "releaseYear"
  | "statedAge"
  | "vintageYear"
> & { series: { name: string } | null };

function getReleaseMarkerFact(bottle: BottleHeaderSpecs): KeyFact | null {
  if (bottle.edition && isBatchEdition(bottle.edition)) {
    return {
      label: "Batch",
      value: bottle.edition.replace(/^batch(?:\s+(?:no\.?|number))?\s+/iu, ""),
    };
  }
  return bottle.caskNumber ? { label: "Cask", value: bottle.caskNumber } : null;
}

// A selection or other worded edition, such as `for La Maison du Whisky`.
function getEditionFact(bottle: BottleHeaderSpecs): KeyFact | null {
  return bottle.edition && !isBatchEdition(bottle.edition)
    ? { label: "Edition", value: bottle.edition, text: true }
    : null;
}

function getYearFact(bottle: BottleHeaderSpecs): KeyFact | null {
  if (bottle.vintageYear !== null) {
    return { label: "Vintage", value: String(bottle.vintageYear) };
  }
  if (bottle.bottlingYear !== null) {
    return { label: "Bottled", value: String(bottle.bottlingYear) };
  }
  if (bottle.releaseYear !== null) {
    return { label: "Released", value: String(bottle.releaseYear) };
  }
  return null;
}

// Bottle Presentation: show stated age once, so an age the name prints stays
// out of the key facts.
function getAgeFact(bottle: BottleHeaderSpecs, name: string): KeyFact | null {
  if (bottle.statedAge === null) {
    return bottle.noAgeStatement ? { label: "Age", value: "NAS" } : null;
  }
  return nameIncludesAge(name, bottle.statedAge)
    ? null
    : { label: "Age", value: `${bottle.statedAge} years` };
}

/** Matches an age the name prints, such as `16-year-old` or `16 Years`. */
export function nameIncludesAge(name: string, statedAge: number) {
  return new RegExp(`\\b${statedAge}[- ]years?\\b`, "iu").test(name);
}

/**
 * Whole words only, so `12` is not found in `120` and `Cask` is not found in
 * `Casks`. A wrong match only drops or moves one fact, so this stays simple.
 */
export function nameIncludes(name: string, text: string) {
  const escaped = text
    .replace(/^(?:cask\s*)?(?:no\.?|#)?\s*(?=\d)/iu, "")
    .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
    "iu",
  ).test(name);
}

/**
 * Bottle Presentation: the detailed header shows up to three facts. Series
 * leads, since the header title leaves it out. Then come ABV, age, any other
 * edition, one year, batch or cask, and category to fill a spare slot. ABV,
 * age, or series the name already prints is left out. An edition, year, batch,
 * or cask the name prints moves behind category, and missing facts leave no
 * placeholder.
 */
export function getBottleHeaderSpecs(
  bottle: BottleHeaderSpecs,
  name: string,
): KeyFactList | null {
  const releaseMarker = getReleaseMarkerFact(bottle);
  const edition = getEditionFact(bottle);
  const year = getYearFact(bottle);
  const inName = (fact: KeyFact | null) =>
    fact !== null && nameIncludes(name, String(fact.value));
  const abv =
    bottle.abv === null ? null : { label: "ABV", value: formatAbv(bottle.abv) };
  const series = bottle.series
    ? { label: "Series", value: bottle.series.name, text: true }
    : null;
  const [first, second, third] = [
    inName(series) ? null : series,
    inName(abv) ? null : abv,
    getAgeFact(bottle, name),
    inName(edition) ? null : edition,
    inName(year) ? null : year,
    inName(releaseMarker) ? null : releaseMarker,
    bottle.category
      ? { label: "Category", value: formatCategoryName(bottle.category) }
      : null,
    inName(edition) ? edition : null,
    inName(year) ? year : null,
    inName(releaseMarker) ? releaseMarker : null,
  ].filter((fact): fact is KeyFact => fact !== null);

  if (!first) return null;
  if (!second) return [first];
  if (!third) return [first, second];
  return [first, second, third];
}
