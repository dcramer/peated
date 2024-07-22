"use client";

import { trpc } from "@peated/web/lib/trpc/client";
import type { ComponentProps } from "react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { logError } from "../lib/log";
import DistributionChart, {
  DistributionChartError,
  DistributionChartLegend,
  DistributionChartSkeleton,
} from "./distributionChart";

function UserLocationChartElement({ userId }: { userId: number }) {
  const [data] = trpc.userRegionList.useSuspenseQuery({
    user: userId,
  });

  const { results, totalCount } = data;

  return (
    <DistributionChart
      items={results.map((t) => ({
        ...t,
        name: t.region ? t.region.name : t.country.name,
        count: t.count,
      }))}
      totalCount={totalCount}
      href={(item) =>
        `/locations/${item.country.slug}${item.region ? `/regions/${item.region.slug}` : ""}`
      }
    />
  );
}

export default function UserLocationChart(
  props: ComponentProps<typeof UserLocationChartElement>,
) {
  return (
    <div>
      <DistributionChartLegend>Top Regions</DistributionChartLegend>

      <ErrorBoundary fallback={<DistributionChartError />} onError={logError}>
        <Suspense fallback={<DistributionChartSkeleton />}>
          <UserLocationChartElement {...props} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
