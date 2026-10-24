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

/** Order release evidence before textual relevance; retain conflicting suggestions. */
export function orderBottleCandidateComparisons(
  left: BottleCandidateComparison,
  right: BottleCandidateComparison,
) {
  const releases = new Set<string>(COMPARABLE_BOTTLE_FIELDS);
  const count = (fields: readonly string[]) =>
    fields.filter((f) => releases.has(f)).length;
  return (
    count(left.conflicts) - count(right.conflicts) ||
    count(right.agreements) - count(left.agreements) ||
    left.conflicts.length - right.conflicts.length ||
    right.agreements.length - left.agreements.length
  );
}
