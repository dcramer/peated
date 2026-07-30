"use client";

import { formatFlavorProfile } from "@peated/server/lib/format";
import {
  InsightCard,
  InsightCardSkeleton,
  RankedInsightBars,
} from "@peated/web/components/insightCard";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQueries } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

function UserTastingInsightsContent({ userId }: { userId: number }) {
  const orpc = useORPC();
  const [regionsQuery, flavorsQuery] = useSuspenseQueries({
    queries: [
      orpc.users.regionList.queryOptions({
        input: { user: userId },
      }),
      orpc.users.flavorList.queryOptions({
        input: { user: userId },
      }),
    ],
  });

  const regions = regionsQuery.data.results;
  const flavors = flavorsQuery.data.results;

  if (!regions.length && !flavors.length) return null;

  return (
    <section aria-labelledby="tastings-heading">
      <h2
        id="tastings-heading"
        className="mb-3 text-lg font-semibold text-white"
      >
        Tastings
      </h2>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {regions.length ? (
          <InsightCard title="Top regions" className="only:lg:col-span-2">
            <RankedInsightBars
              unit="tasting"
              items={regions.map((item) => ({
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
          <InsightCard title="Top flavors" className="only:lg:col-span-2">
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
      </div>
    </section>
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
