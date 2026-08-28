"use client";

import { RATING_BANDS } from "@peated/server/constants";
import { formatFlavorProfile } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import AgeInsightCard from "@peated/web/components/ageInsightCard";
import {
  InsightCard,
  InsightCardSkeleton,
  RankedInsightBars,
} from "@peated/web/components/insightCard";
import Link from "@peated/web/components/link";
import classNames from "@peated/web/lib/classNames";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQueries } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

function UserTastingInsightsContent({ userId }: { userId: number }) {
  const orpc = useORPC();
  const [regionsQuery, flavorsQuery, statsQuery] = useSuspenseQueries({
    queries: [
      orpc.users.regionList.queryOptions({
        input: { user: userId },
      }),
      orpc.users.flavorList.queryOptions({
        input: { user: userId },
      }),
      orpc.users.tastingStats.queryOptions({
        input: { user: userId },
      }),
    ],
  });

  const regions = regionsQuery.data.results;
  const flavors = flavorsQuery.data.results;
  const stats = statsQuery.data;
  const showSnapshot = stats.total > 0;
  const showAge = stats.age.knownCount >= 3;
  const insightCardCount =
    Number(regions.length > 0) + Number(flavors.length > 0) + Number(showAge);
  const cardCount = Number(showSnapshot) + insightCardCount;

  if (!cardCount) return null;

  return (
    <section aria-labelledby="tastings-heading">
      <h2
        id="tastings-heading"
        className="mb-3 text-lg font-semibold text-white"
      >
        Tastings
      </h2>
      <p className="text-muted -mt-2 mb-3 text-sm">
        Patterns across the bottles they’ve tasted.
      </p>
      <div
        className={classNames(
          "grid grid-cols-1 gap-3",
          insightCardCount === 2 && "lg:grid-cols-2",
          insightCardCount >= 3 && "lg:grid-cols-3",
        )}
      >
        {showSnapshot ? (
          <TastingSnapshotCard
            stats={stats}
            className={classNames(
              insightCardCount === 2 && "lg:col-span-2",
              insightCardCount >= 3 && "lg:col-span-3",
            )}
          />
        ) : null}
        {regions.length ? (
          <InsightCard title="Top regions">
            <RankedInsightBars
              unit="tasting"
              items={regions.slice(0, 10).map((item) => ({
                id: item.region
                  ? `${item.country.slug}/${item.region.slug}`
                  : item.country.slug,
                label: item.region?.name ?? item.country.name,
                count: item.count,
                href: `/locations/${item.country.slug}${
                  item.region ? `/regions/${item.region.slug}` : ""
                }`,
              }))}
            />
          </InsightCard>
        ) : null}
        {flavors.length ? (
          <InsightCard title="Top flavors">
            <RankedInsightBars
              unit="tasting"
              items={flavors.map((item) => ({
                id: item.flavorProfile,
                label: formatFlavorProfile(item.flavorProfile),
                count: item.count,
                href: `/bottles?flavorProfile=${encodeURIComponent(
                  item.flavorProfile,
                )}`,
              }))}
            />
          </InsightCard>
        ) : null}
        {showAge ? (
          <AgeInsightCard
            age={stats.age}
            title="Ages tasted"
            total={stats.total}
            unit="tasting"
          />
        ) : null}
      </div>
    </section>
  );
}

type TastingStats = Outputs["users"]["tastingStats"];

export function TastingSnapshotCard({
  stats,
  className,
}: {
  stats: TastingStats;
  className?: string;
}) {
  const repeatPours = stats.total - stats.uniqueBottles;

  return (
    <InsightCard title="Tasting snapshot" className={className}>
      <div className="grid flex-1 gap-6 sm:grid-cols-[minmax(0,1.35fr)_minmax(12rem,0.65fr)] sm:divide-x sm:divide-slate-800">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-1">
          {RATING_BANDS.map((band) => (
            <div key={band.id} className="flex justify-between gap-3 text-sm">
              <dt>
                {band.label}{" "}
                <span className="text-muted">
                  {band.min}–{band.max}
                </span>
              </dt>
              <dd className="font-semibold tabular-nums">
                {stats.bands[band.id].toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col justify-center sm:pl-6">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              {repeatPours.toLocaleString()}
            </span>
            <span className="text-sm font-medium text-slate-200">
              {repeatPours === 1 ? "repeat pour" : "repeat pours"}
            </span>
          </div>
          {stats.mostTastedBottle ? (
            <p className="text-muted mt-3 text-xs">
              Most revisited{" "}
              <Link
                href={`/bottles/${stats.mostTastedBottle.id}`}
                className="font-medium text-slate-200 hover:text-white"
              >
                {stats.mostTastedBottle.name}
              </Link>{" "}
              <span className="whitespace-nowrap">
                · {stats.mostTastedBottle.count.toLocaleString()} times
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </InsightCard>
  );
}

function UserTastingInsightsSkeleton() {
  return (
    <section aria-labelledby="tastings-loading-heading">
      <h2
        id="tastings-loading-heading"
        className="mb-3 text-lg font-semibold text-white"
      >
        Tastings
      </h2>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <InsightCardSkeleton />
        <InsightCardSkeleton />
      </div>
    </section>
  );
}

function UserTastingInsightsError() {
  return (
    <section aria-labelledby="tastings-error-heading">
      <h2
        id="tastings-error-heading"
        className="mb-3 text-lg font-semibold text-white"
      >
        Tastings
      </h2>
      <div className="text-muted rounded border border-slate-800 bg-slate-950/70 p-4 text-sm">
        Tasting insights could not be loaded.
      </div>
    </section>
  );
}

export default function UserTastingInsights({ userId }: { userId: number }) {
  return (
    <ErrorBoundary
      fallback={<UserTastingInsightsError />}
      onError={(error) => logError(error, { context: "tasting_insights" })}
    >
      <Suspense fallback={<UserTastingInsightsSkeleton />}>
        <UserTastingInsightsContent userId={userId} />
      </Suspense>
    </ErrorBoundary>
  );
}
