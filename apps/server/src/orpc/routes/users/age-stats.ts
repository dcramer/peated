import { AGE_BUCKETS, isAgeInBucket } from "@peated/server/constants";
import type { AgeStats } from "@peated/server/schemas";

function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

export function buildAgeStats(ages: number[], unstatedCount: number): AgeStats {
  return {
    knownCount: ages.length,
    median: median(ages),
    oldest: ages.length
      ? ages.reduce((oldest, age) => Math.max(oldest, age))
      : null,
    buckets: [
      ...AGE_BUCKETS.map((bucket) => ({
        id: bucket.id,
        label: bucket.label,
        count: ages.filter((age) => isAgeInBucket(age, bucket)).length,
      })),
      {
        id: "unstated" as const,
        label: "Unstated",
        count: unstatedCount,
      },
    ],
  };
}
