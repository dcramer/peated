"use client";

import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import AgeInsightCard from "@peated/web/components/ageInsightCard";
import {
  InsightCard,
  InsightCardSkeleton,
  RankedInsightBars,
} from "@peated/web/components/insightCard";
import Link from "@peated/web/components/link";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

type LibraryStats = Outputs["users"]["libraryStats"];

const MINIMUM_AGE_SAMPLE = 3;

function ProducerInsights({
  stats,
  username,
}: {
  stats: LibraryStats;
  username: string;
}) {
  const producerGroups = [
    {
      id: "brands",
      title: "Brands",
      items: stats.brands,
      filter: "brand",
    },
    {
      id: "distillers",
      title: "Distilleries",
      items: stats.distillers,
      filter: "distiller",
    },
  ].filter((group) => group.items.length > 0);

  if (!producerGroups.length) return null;

  return (
    <InsightCard title="Most collected" className="lg:col-span-2">
      <div
        className={`grid gap-4 ${producerGroups.length > 1 ? "sm:grid-cols-2 sm:divide-x sm:divide-slate-800" : ""}`}
      >
        {producerGroups.map((group, index) => (
          <div key={group.id} className={index ? "sm:pl-5" : ""}>
            <h4 className="text-muted mb-2 text-xs font-medium uppercase tracking-wide">
              {group.title}
            </h4>
            <RankedInsightBars
              unit="bottle"
              items={group.items.slice(0, 3).map((entity) => ({
                id: entity.id,
                label: entity.name,
                count: entity.count,
                href: `/users/${username}/library?${group.filter}=${entity.id}`,
              }))}
            />
          </div>
        ))}
      </div>
    </InsightCard>
  );
}

function LibraryStatus({
  stats,
  username,
}: {
  stats: LibraryStats;
  username: string;
}) {
  const items = [
    {
      id: "open",
      label: "Open",
      count: stats.status.open,
      color: "bg-highlight",
    },
    {
      id: "sealed",
      label: "Sealed",
      count: stats.status.sealed,
      color: "bg-slate-400",
    },
    {
      id: "unset",
      label: "Not set",
      count: stats.status.unspecified,
      color: "bg-slate-700",
    },
  ].filter((item) => item.count > 0);

  if (!stats.status.open && !stats.status.sealed) return null;

  return (
    <InsightCard title="Bottle status" detail={`${stats.total} bottles`}>
      <div
        className="mb-5 flex h-3 overflow-hidden rounded-full bg-slate-800"
        aria-hidden="true"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={item.color}
            style={{ width: `${(item.count / stats.total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/users/${username}/library?status=${item.id}`}
              className="focus-visible:ring-highlight group flex items-center justify-between rounded text-xs focus-visible:outline-none focus-visible:ring-2"
            >
              <span className="flex items-center gap-2 font-medium text-slate-200 group-hover:text-white">
                <span className={`h-2 w-2 rounded-full ${item.color}`} />
                {item.label}
              </span>
              <span className="text-muted tabular-nums">
                {item.count.toLocaleString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
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
  const showProducers = stats.brands.length > 0 || stats.distillers.length > 0;
  const showStatus = stats.status.open > 0 || stats.status.sealed > 0;
  const cardCount =
    Number(showProducers) +
    Number(showStatus) +
    Number(showAge || showCategories);

  if (!cardCount) return null;

  return (
    <div
      className={`mb-4 grid grid-cols-1 gap-3 ${cardCount > 1 ? "lg:grid-cols-2" : ""}`}
    >
      {showProducers ? (
        <ProducerInsights stats={stats} username={username} />
      ) : null}
      {showStatus ? <LibraryStatus stats={stats} username={username} /> : null}
      {showAge ? (
        <AgeInsightCard
          age={stats.age}
          title="Bottle ages"
          total={stats.total}
          unit="bottle"
        />
      ) : null}
      {showCategories ? <CategoryDistribution stats={stats} /> : null}
    </div>
  );
}

function LibraryInsightsSkeleton() {
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
      <InsightCardSkeleton className="lg:col-span-2" />
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
