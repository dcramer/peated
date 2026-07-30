import type { Outputs } from "@peated/server/orpc/router";
import { InsightCard } from "@peated/web/components/insightCard";

type AgeStats = Outputs["users"]["libraryStats"]["age"];

function formatCount(count: number, unit: string) {
  return `${count.toLocaleString()} ${unit}${count === 1 ? "" : "s"}`;
}

function formatAge(age: number) {
  return Number.isInteger(age) ? age.toLocaleString() : age.toFixed(1);
}

export default function AgeInsightCard({
  age,
  title,
  total,
  unit,
}: {
  age: AgeStats;
  title: string;
  total: number;
  unit: string;
}) {
  const largestCount = Math.max(
    ...age.buckets.map((bucket) => bucket.count),
    1,
  );
  const detail = [
    age.median !== null ? `Median ${formatAge(age.median)} yr` : null,
    age.oldest !== null ? `Oldest ${formatAge(age.oldest)} yr` : null,
  ]
    .filter((value): value is string => value !== null)
    .join(" · ");

  return (
    <InsightCard title={title} detail={detail}>
      <div className="grid h-28 grid-cols-6 gap-1" aria-hidden="true">
        {age.buckets.map((bucket) => (
          <div key={bucket.id} className="flex min-w-0 flex-col items-center">
            <span className="text-muted mb-1 h-4 text-[10px] tabular-nums">
              {bucket.count ? bucket.count.toLocaleString() : ""}
            </span>
            <div className="flex min-h-0 w-full flex-1 items-end justify-center">
              <div
                className={
                  bucket.id === "unstated"
                    ? "w-3/5 rounded-t bg-slate-600"
                    : "bg-highlight w-3/5 rounded-t"
                }
                style={{
                  height: bucket.count
                    ? `${Math.max(10, (bucket.count / largestCount) * 100)}%`
                    : 0,
                }}
              />
            </div>
            <span className="mt-1 min-h-7 text-center text-[10px] leading-3 text-slate-400">
              {bucket.label}
            </span>
          </div>
        ))}
      </div>
      <ul className="sr-only">
        {age.buckets.map((bucket) => (
          <li key={bucket.id}>
            {bucket.label}: {formatCount(bucket.count, unit)}
          </li>
        ))}
      </ul>
      <p className="text-muted mt-1 text-[11px]">
        Age stated for {age.knownCount.toLocaleString()} of{" "}
        {formatCount(total, unit)}
      </p>
    </InsightCard>
  );
}
