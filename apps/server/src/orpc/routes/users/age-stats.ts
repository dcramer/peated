import { z } from "zod";

export const AgeStatsSchema = z.object({
  knownCount: z.number(),
  median: z.number().nullable(),
  oldest: z.number().nullable(),
  buckets: z.array(
    z.object({
      id: z.enum([
        "under10",
        "from10To12",
        "from13To17",
        "from18To24",
        "atLeast25",
        "unstated",
      ]),
      label: z.string(),
      count: z.number(),
    }),
  ),
});

export type AgeStats = z.infer<typeof AgeStatsSchema>;

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
    oldest: ages.length ? Math.max(...ages) : null,
    buckets: [
      {
        id: "under10",
        label: "Under 10",
        count: ages.filter((age) => age < 10).length,
      },
      {
        id: "from10To12",
        label: "10–12",
        count: ages.filter((age) => age >= 10 && age <= 12).length,
      },
      {
        id: "from13To17",
        label: "13–17",
        count: ages.filter((age) => age >= 13 && age <= 17).length,
      },
      {
        id: "from18To24",
        label: "18–24",
        count: ages.filter((age) => age >= 18 && age <= 24).length,
      },
      {
        id: "atLeast25",
        label: "25+",
        count: ages.filter((age) => age >= 25).length,
      },
      {
        id: "unstated",
        label: "Unstated",
        count: unstatedCount,
      },
    ],
  };
}
