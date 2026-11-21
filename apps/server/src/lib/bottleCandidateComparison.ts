import {
  COMPARABLE_BOTTLE_FIELDS,
  compareBottleFields,
} from "@peated/bottle-classifier/fieldConflicts";
import { BottleCandidateComparisonSchema } from "@peated/bottle-classifier/internal/types";
import type { z } from "zod";
import type {
  BottleCreateCandidate,
  BottleCreateCandidateInput,
} from "./bottleCreateCandidates";
export { BottleCandidateComparisonSchema };

export type BottleCandidateComparison = z.infer<
  typeof BottleCandidateComparisonSchema
>;

function normalized(value: string) {
  return value.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

function sameEntity(
  expected: { id?: number | null; name: string },
  actual: { id?: number | null; name: string },
) {
  return expected.id != null && actual.id != null
    ? expected.id === actual.id
    : normalized(expected.name) === normalized(actual.name);
}

/** Search comparisons describe supplied facts, never authorize assignment. */
export function compareBottleCandidate(
  input: BottleCreateCandidateInput,
  candidate: BottleCreateCandidate,
): BottleCandidateComparison {
  // The classifier package owns the typed-field rule for every source.
  const fields = compareBottleFields(input, candidate);
  const result: BottleCandidateComparison = {
    agreements: [...fields.agreements],
    missing: [...fields.missing],
    conflicts: [...fields.conflicts],
  };
  for (const key of ["brand", "bottler", "series"] as const) {
    const expected = input[key];
    if (!expected) continue;
    const actual = candidate[key];
    result[
      !actual
        ? "missing"
        : sameEntity(expected, actual)
          ? "agreements"
          : "conflicts"
    ].push(key);
  }
  if (input.distillers?.length) {
    if (!candidate.distillers.length) result.missing.push("distillers");
    else
      result[
        input.distillers.every((d) =>
          candidate.distillers.some((c) => sameEntity(d, c)),
        )
          ? "agreements"
          : "conflicts"
      ].push("distillers");
  }
  return result;
}

const PRODUCER_FIELDS = new Set(["brand", "bottler", "distillers"]);

function hasDistilleryConflict(comparison: BottleCandidateComparison) {
  return comparison.conflicts.includes("distillers") ? 1 : 0;
}

function sharesProducer(comparison: BottleCandidateComparison) {
  return comparison.agreements.some((field) => PRODUCER_FIELDS.has(field))
    ? 1
    : 0;
}

/**
 * Bottle search owns this rule, for every caller: the producer comes before
 * release facts. A Bottle from another distillery is another Bottle, so it
 * sorts last. Next, a Bottle that shares the distillery, Brand, or bottler
 * leads one that shares none, because an unrelated Bottle with the same age
 * or vintage is not a possible match. A Brand conflict alone only loses this
 * step: members and labels often name the bottler or owner as the Brand.
 * Release facts then order Bottles, before text relevance. Conflicting
 * Bottles stay in the list.
 */
export function orderBottleCandidateComparisons(
  left: BottleCandidateComparison,
  right: BottleCandidateComparison,
) {
  const releases = new Set<string>(COMPARABLE_BOTTLE_FIELDS);
  const count = (fields: readonly string[]) =>
    fields.filter((f) => releases.has(f)).length;
  return (
    hasDistilleryConflict(left) - hasDistilleryConflict(right) ||
    sharesProducer(right) - sharesProducer(left) ||
    count(left.conflicts) - count(right.conflicts) ||
    count(right.agreements) - count(left.agreements) ||
    left.conflicts.length - right.conflicts.length ||
    right.agreements.length - left.agreements.length
  );
}
