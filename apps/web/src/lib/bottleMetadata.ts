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
>;

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
    ? { label: "Edition", value: bottle.edition }
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
  const ageInName = new RegExp(
    `\\b${bottle.statedAge}[- ]years?\\b`,
    "iu",
  ).test(name);
  return ageInName
    ? null
    : { label: "Age", value: `${bottle.statedAge} years` };
}

// Whole words only, so `12` is not found in `120`. A wrong match only moves a
// fact to the back of the line, so this stays simple.
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
 * Bottle Presentation: the detailed header shows up to three facts, ranked by
 * how precisely they identify the release: ABV, batch or cask, age, any other
 * edition, one year, then category to fill a spare slot. A batch, cask,
 * edition, or year the name already prints moves behind category, and missing
 * facts leave no placeholder.
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
  const [first, second, third] = [
    bottle.abv === null ? null : { label: "ABV", value: formatAbv(bottle.abv) },
    inName(releaseMarker) ? null : releaseMarker,
    getAgeFact(bottle, name),
    inName(edition) ? null : edition,
    inName(year) ? null : year,
    bottle.category
      ? { label: "Category", value: formatCategoryName(bottle.category) }
      : null,
    inName(releaseMarker) ? releaseMarker : null,
    inName(edition) ? edition : null,
    inName(year) ? year : null,
  ].filter((fact): fact is KeyFact => fact !== null);

  if (!first) return null;
  if (!second) return [first];
  if (!third) return [first, second];
  return [first, second, third];
}
