import type { BottleExtractedDetails } from "./classifierTypes";

export function exactEditionMarkersMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizeMarker = (value: string | null | undefined) =>
    (value ?? "")
      .toLowerCase()
      .replace(/\b(?:no|number)\b\.?/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  return normalizeMarker(left) === normalizeMarker(right);
}

/** The typed Bottle fields that source facts can directly contradict. */
export type ComparableBottleFields = {
  category: string | null;
  statedAge: number | null;
  abv: number | null;
  vintageYear: number | null;
  releaseYear: number | null;
  caskStrength: boolean | null;
  singleCask: boolean | null;
  edition: string | null;
  caskNumber?: string | null;
  bottlingYear?: number | null;
  releaseMonth?: number | null;
  releaseDay?: number | null;
};

export type BottleFieldConflict =
  | "category"
  | "statedAge"
  | "abv"
  | "vintageYear"
  | "releaseYear"
  | "caskStrength"
  | "singleCask"
  | "edition"
  | "caskNumber"
  | "bottlingYear"
  | "releaseMonth"
  | "releaseDay";

/**
 * Deterministic code rule (owner: Bottle classifier): code may reject only a
 * direct contradiction between two populated, typed fields. Names, Brands,
 * bottlers, and other free text are left to the classifier because comparing
 * them needs judgment. An empty field on either side never conflicts.
 */
export function getBottleFieldConflicts(
  facts: BottleExtractedDetails | null,
  bottle: ComparableBottleFields,
): BottleFieldConflict[] {
  if (!facts) return [];

  const conflicts: BottleFieldConflict[] = [];
  const differs = <T>(
    left: T | null | undefined,
    right: T | null | undefined,
  ) => left != null && right != null && left !== right;

  if (differs(facts.category, bottle.category)) conflicts.push("category");
  if (differs(facts.stated_age, bottle.statedAge)) conflicts.push("statedAge");
  // Stores round ABV differently, so only a gap of a tenth or more counts.
  if (
    facts.abv !== null &&
    bottle.abv !== null &&
    Math.abs(facts.abv - bottle.abv) >= 0.1
  ) {
    conflicts.push("abv");
  }
  if (differs(facts.vintage_year, bottle.vintageYear)) {
    conflicts.push("vintageYear");
  }
  if (differs(facts.release_year, bottle.releaseYear)) {
    conflicts.push("releaseYear");
  }
  if (differs(facts.cask_strength, bottle.caskStrength)) {
    conflicts.push("caskStrength");
  }
  if (differs(facts.single_cask, bottle.singleCask)) {
    conflicts.push("singleCask");
  }
  if (
    facts.edition &&
    bottle.edition &&
    !exactEditionMarkersMatch(facts.edition, bottle.edition)
  ) {
    conflicts.push("edition");
  }
  if (differs(facts.cask_number, bottle.caskNumber))
    conflicts.push("caskNumber");
  if (differs(facts.bottling_year, bottle.bottlingYear))
    conflicts.push("bottlingYear");
  if (differs(facts.release_month, bottle.releaseMonth))
    conflicts.push("releaseMonth");
  if (differs(facts.release_day, bottle.releaseDay))
    conflicts.push("releaseDay");

  return conflicts;
}
