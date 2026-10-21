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

// Matches whole words and numbers only, so cask `12` is not found in
// `12-year-old` and year `1984` is not found in `19841`.
const CASK_PREFIX = String.raw`(?:cask\s*(?:no\.?\s*)?|no\.?\s*|#\s*)`;

function nameIncludes(name: string, text: string, prefix = "") {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${prefix}${escaped}(?![\\p{L}\\p{N}])`,
    "iu",
  ).test(name);
}

function getReleaseMarkerFact(
  bottle: BottleHeaderSpecs,
  name: string,
): KeyFact | null {
  if (bottle.edition && isBatchEdition(bottle.edition)) {
    return nameIncludes(name, bottle.edition)
      ? null
      : {
          label: "Batch",
          value: bottle.edition.replace(
            /^batch(?:\s+(?:no\.?|number))?\s+/iu,
            "",
          ),
        };
  }
  if (bottle.caskNumber) {
    return nameIncludes(name, bottle.caskNumber, CASK_PREFIX)
      ? null
      : { label: "Cask", value: bottle.caskNumber };
  }
  return null;
}

function getYearFact(bottle: BottleHeaderSpecs, name: string): KeyFact | null {
  const year =
    bottle.vintageYear !== null
      ? { label: "Vintage", value: bottle.vintageYear }
      : bottle.bottlingYear !== null
        ? { label: "Bottled", value: bottle.bottlingYear }
        : bottle.releaseYear !== null
          ? { label: "Released", value: bottle.releaseYear }
          : null;
  return year && !nameIncludes(name, String(year.value))
    ? { label: year.label, value: String(year.value) }
    : null;
}

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

/**
 * Bottle Presentation: the detailed header shows up to three facts, ranked by
 * how precisely they identify the release: ABV, batch or cask, age, one year,
 * then category to fill a spare slot. Facts the name already prints are left
 * out, and missing facts leave no placeholder.
 */
export function getBottleHeaderSpecs(
  bottle: BottleHeaderSpecs,
  name: string,
): KeyFactList | null {
  const [first, second, third] = [
    bottle.abv === null ? null : { label: "ABV", value: formatAbv(bottle.abv) },
    getReleaseMarkerFact(bottle, name),
    getAgeFact(bottle, name),
    getYearFact(bottle, name),
    bottle.category
      ? { label: "Category", value: formatCategoryName(bottle.category) }
      : null,
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
