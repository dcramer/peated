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

function UserFlavorDistributionElement({ userId }: { userId: number }) {
  const [data] = trpc.userFlavorList.useSuspenseQuery({
    user: userId,
  });

  const { results, totalCount } = data;

  return (
    <DistributionChart
      items={results.map((t) => ({
        name: t.flavorProfile,
        count: t.count,
        flavorProfile: t.flavorProfile,
      }))}
      totalCount={totalCount}
      href={(item) => `/bottles?flavorProfile=${encodeURIComponent(item.name)}`}
    />
  );
}

export default function UserFlavorDistributionChart(
  props: ComponentProps<typeof UserFlavorDistributionElement>,
) {
  return (
    <div>
      <DistributionChartLegend>Top Flavors</DistributionChartLegend>
      <ErrorBoundary fallback={<DistributionChartError />} onError={logError}>
        <Suspense fallback={<DistributionChartSkeleton />}>
          <UserFlavorDistributionElement {...props} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
