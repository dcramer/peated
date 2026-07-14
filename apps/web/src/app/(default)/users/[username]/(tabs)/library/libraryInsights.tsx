"use client";

import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import Link from "@peated/web/components/link";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

type LibraryStats = Outputs["users"]["libraryStats"];
type RankedItem = {
  id: string | number;
  label: string;
  count: number;
  href?: string;
};

const MINIMUM_AGE_SAMPLE = 3;

function formatBottleCount(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? "bottle" : "bottles"}`;
}

function RankedBars({ items }: { items: RankedItem[] }) {
  const largestCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <ol className="space-y-2">
      {items.map((item) => {
        const content = (
          <>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-medium text-slate-200">
                {item.label}
              </span>
              <span className="text-muted shrink-0 tabular-nums">
                {item.count.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="bg-highlight h-full rounded-full"
                style={{ width: `${(item.count / largestCount) * 100}%` }}
              />
            </div>
          </>
        );

        return (
          <li key={item.id}>
            {item.href ? (
              <Link
                href={item.href}
                className="focus-visible:ring-highlight group block rounded focus-visible:outline-none focus-visible:ring-2"
                aria-label={`${item.label}: ${formatBottleCount(item.count)}`}
              >
                {content}
              </Link>
            ) : (
              <div
                aria-label={`${item.label}: ${formatBottleCount(item.count)}`}
              >
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function InsightCard({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded border border-slate-800 bg-slate-950/70 p-3">
      <div className="mb-3 flex min-h-8 items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {detail ? (
          <span className="text-muted text-right text-[11px] leading-4">
            {detail}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
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
      <div className="grid h-28 grid-cols-6 gap-1" aria-hidden="true">
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
      <RankedBars
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
          <RankedBars
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
      <div className="h-44 animate-pulse rounded bg-slate-900" />
      <div className="h-44 animate-pulse rounded bg-slate-900" />
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
