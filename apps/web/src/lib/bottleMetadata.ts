import {
  formatAbv,
  getBottleReleaseMetadata,
  isBatchEdition,
} from "@peated/server/lib/bottleDisplayName";
import { formatReleaseDate } from "@peated/server/lib/bottleRelease";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Bottle } from "@peated/server/types";
import type {
  KeyFact,
  KeyFactList,
} from "@peated/web/components/catalogDetails.stylex";

export type BottleReviewMetadata = Pick<
  Bottle,
  "abv" | "edition" | "releaseYear" | "statedAge" | "vintageYear"
>;

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
    .replace(/^(?:cask\s*)?(?:no\.?\s*|#\s*)?/iu, "")
    .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
    "iu",
  ).test(name);
}

/**
 * Bottle Presentation: the detailed header shows up to three facts, ranked by
 * how precisely they identify the release: ABV, batch or cask, age, one year,
 * then category to fill a spare slot. A batch, cask, or year the name already
 * prints moves behind category, and missing facts leave no placeholder.
 */
export function getBottleHeaderSpecs(
  bottle: BottleHeaderSpecs,
  name: string,
): KeyFactList | null {
  const releaseMarker = getReleaseMarkerFact(bottle);
  const year = getYearFact(bottle);
  const inName = (fact: KeyFact | null) =>
    fact !== null && nameIncludes(name, String(fact.value));
  const [first, second, third] = [
    bottle.abv === null ? null : { label: "ABV", value: formatAbv(bottle.abv) },
    inName(releaseMarker) ? null : releaseMarker,
    getAgeFact(bottle, name),
    inName(year) ? null : year,
    bottle.category
      ? { label: "Category", value: formatCategoryName(bottle.category) }
      : null,
    inName(releaseMarker) ? releaseMarker : null,
    inName(year) ? year : null,
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

/** Returns the compact facts that distinguish one reviewed release from another. */
export function getBottleReviewMetadata(bottle: BottleReviewMetadata) {
  return [
    bottle.statedAge === null ? null : `${bottle.statedAge} years`,
    bottle.abv === null
      ? null
      : `${bottle.abv.toFixed(1).replace(/\.0$/, "")}% ABV`,
    getBottleReleaseMetadata(bottle),
  ].filter((value): value is string => Boolean(value));
}
