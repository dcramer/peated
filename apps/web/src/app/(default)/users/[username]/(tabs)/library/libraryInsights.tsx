"use client";

import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import {
  InsightCard,
  InsightCardSkeleton,
  RankedInsightBars,
} from "@peated/web/components/insightCard";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

type LibraryStats = Outputs["users"]["libraryStats"];

const MINIMUM_AGE_SAMPLE = 3;

function formatBottleCount(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? "bottle" : "bottles"}`;
}

function formatAge(age: number) {
  return Number.isInteger(age) ? age.toLocaleString() : age.toFixed(1);
}

function AgeDistribution({ stats }: { stats: LibraryStats }) {
  const largestCount = Math.max(
    ...stats.age.buckets.map((bucket) => bucket.count),
    1,
  );
  const detail = [
    stats.age.median !== null
      ? `Median ${formatAge(stats.age.median)} yr`
      : null,
    stats.age.oldest !== null
      ? `Oldest ${formatAge(stats.age.oldest)} yr`
      : null,
  ]
    .filter((value): value is string => value !== null)
    .join(" · ");

  return (
    <InsightCard title="Age profile" detail={detail}>
      <div
        className="grid min-h-28 flex-1 grid-cols-6 gap-1"
        data-age-profile-chart
        aria-hidden="true"
      >
        {stats.age.buckets.map((bucket) => (
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
        {stats.age.buckets.map((bucket) => (
          <li key={bucket.id}>
            {bucket.label}: {formatBottleCount(bucket.count)}
          </li>
        ))}
      </ul>
      <p className="text-muted mt-1 text-[11px]">
        Age stated for {stats.age.knownCount.toLocaleString()} of{" "}
        {stats.total.toLocaleString()} bottles
      </p>
    </InsightCard>
  );
}

function CategoryDistribution({ stats }: { stats: LibraryStats }) {
  return (
    <InsightCard title="Library types" detail="Age data is limited">
      <RankedInsightBars
        unit="bottle"
        items={stats.categories.map((item) => ({
          id: item.category,
          label: formatCategoryName(item.category),
          count: item.count,
        }))}
      />
    </InsightCard>
  );
}

export function LibraryInsightsContent({
  stats,
  username,
}: {
  stats: LibraryStats;
  username: string;
}) {
  if (!stats.total) return null;

  const showAge = stats.age.knownCount >= MINIMUM_AGE_SAMPLE;
  const showCategories = !showAge && stats.categories.length > 0;
  const showDistillers = stats.distillers.length > 0;
  const cardCount = Number(showDistillers) + Number(showAge || showCategories);

  if (!cardCount) return null;

  return (
    <div
      className={`mb-4 grid grid-cols-1 gap-3 px-3 sm:px-0 ${cardCount > 1 ? "lg:grid-cols-2" : ""}`}
    >
      {showDistillers ? (
        <InsightCard title="Top distilleries">
          <RankedInsightBars
            unit="bottle"
            items={stats.distillers.map((distiller) => ({
              id: distiller.id,
              label: distiller.name,
              count: distiller.count,
              href: `/users/${username}/library?distiller=${distiller.id}`,
            }))}
          />
        </InsightCard>
      ) : null}
      {showAge ? <AgeDistribution stats={stats} /> : null}
      {showCategories ? <CategoryDistribution stats={stats} /> : null}
    </div>
  );
}

function LibraryInsightsSkeleton() {
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 px-3 sm:px-0 lg:grid-cols-2">
      <InsightCardSkeleton />
      <InsightCardSkeleton />
    </div>
  );
}

export default function LibraryInsights({ username }: { username: string }) {
  const orpc = useORPC();
  const statsQuery = useQuery(
    orpc.users.libraryStats.queryOptions({
      input: { user: username },
    }),
  );

  useEffect(() => {
    if (statsQuery.error) {
      logError(statsQuery.error, { context: "library_insights" });
    }
  }, [statsQuery.error]);

  if (statsQuery.isLoading) return <LibraryInsightsSkeleton />;
  if (!statsQuery.data || statsQuery.isError) return null;

  return <LibraryInsightsContent stats={statsQuery.data} username={username} />;
}
