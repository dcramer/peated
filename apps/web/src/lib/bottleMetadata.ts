import { formatAbv, nameIncludes } from "@peated/server/lib/bottleDisplayName";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Bottle } from "@peated/server/types";
import type { KeyFact } from "@peated/web/components/catalogDetails.stylex";

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

// `Batch 24`, `Batch No. 24`, or `Batch Number 24`; the rest is the batch.
const BATCH_PREFIX = /^batch(?:\s+(?:no\.?|number))?\s+(?=\S)/iu;

function getReleaseMarkerFact(bottle: BottleHeaderSpecs): KeyFact | null {
  if (bottle.edition && BATCH_PREFIX.test(bottle.edition)) {
    return { label: "Batch", value: bottle.edition.replace(BATCH_PREFIX, "") };
  }
  return bottle.caskNumber ? { label: "Cask", value: bottle.caskNumber } : null;
}

// A selection or other worded edition, such as `for La Maison du Whisky`.
function getEditionFact(bottle: BottleHeaderSpecs): KeyFact | null {
  return bottle.edition && !BATCH_PREFIX.test(bottle.edition)
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
  const ageInName = new RegExp(
    `\\b${bottle.statedAge}[- ]years?\\b`,
    "iu",
  ).test(name);
  return ageInName
    ? null
    : { label: "Age", value: `${bottle.statedAge} years` };
}

// A cask value may keep a `Cask No.` or `#` marker the name leaves out. A
// wrong match only drops or moves one header fact, so this stays simple.
function removeCaskMarker(value: string) {
  return value.replace(/^(?:cask\s*)?(?:no\.?|#)?\s*(?=\d)/iu, "");
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
): readonly KeyFact[] | null {
  const releaseMarker = getReleaseMarkerFact(bottle);
  const edition = getEditionFact(bottle);
  const year = getYearFact(bottle);
  const inName = (fact: KeyFact | null) =>
    fact !== null && nameIncludes(name, removeCaskMarker(String(fact.value)));
  const abv =
    bottle.abv === null ? null : { label: "ABV", value: formatAbv(bottle.abv) };
  const series = bottle.series
    ? { label: "Series", value: bottle.series.name, text: true }
    : null;
  const facts = [
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
  ]
    .filter((fact): fact is KeyFact => fact !== null)
    .slice(0, 3);

  return facts.length ? facts : null;
}
