import {
  formatAbv,
  isBatchEdition,
} from "@peated/server/lib/bottleDisplayName";
import { formatReleaseDate } from "@peated/server/lib/bottleRelease";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Bottle } from "@peated/server/types";
import type {
  KeyFact,
  KeyFactList,
} from "@peated/web/components/catalogDetails.stylex";

type BottleReleasePlacement = Pick<
  Bottle,
  "edition" | "releaseDay" | "releaseMonth" | "releaseYear"
>;

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
  const ageInName = new RegExp(
    `\\b${bottle.statedAge}[- ]years?\\b`,
    "iu",
  ).test(name);
  return ageInName
    ? null
    : { label: "Age", value: `${bottle.statedAge} years` };
}

// Whole words only, so `12` is not found in `120`. A wrong match only drops
// or moves one header fact, so this stays simple.
function nameIncludes(name: string, text: string) {
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
 * leads, since the header title leaves it out. Then come ABV, age, one year,
 * batch or cask, and category to fill a spare slot. ABV, age, or series the
 * name already prints is left out. A year, batch, or cask the name prints
 * moves behind category, and missing facts leave no placeholder.
 */
export function getBottleHeaderSpecs(
  bottle: BottleHeaderSpecs,
  name: string,
): KeyFactList | null {
  const releaseMarker = getReleaseMarkerFact(bottle);
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
    inName(year) ? null : year,
    inName(releaseMarker) ? null : releaseMarker,
    bottle.category
      ? { label: "Category", value: formatCategoryName(bottle.category) }
      : null,
    inName(year) ? year : null,
    inName(releaseMarker) ? releaseMarker : null,
  ].filter((fact): fact is KeyFact => fact !== null);

  if (!first) return null;
  if (!second) return [first];
  if (!third) return [first, second];
  return [first, second, third];
}

/** Keeps one release date on the page while retaining batch and date context. */
export function getBottleReleasePlacement(bottle: BottleReleasePlacement) {
  const releaseDate = formatReleaseDate(bottle);
  return isBatchEdition(bottle.edition)
    ? { header: bottle.edition, details: releaseDate }
    : { header: releaseDate, details: null };
}
