"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { logError } from "../lib/log";
import { useORPC } from "../lib/orpc/context";
import DistributionChart, {
  DistributionChartError,
  DistributionChartLegend,
  DistributionChartSkeleton,
} from "./distributionChart";

function BottleTagDistributionElement({ bottleId }: { bottleId: number }) {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.bottles.tags.queryOptions({
      input: {
        bottle: bottleId,
      },
    }),
  );

  const { results, totalCount } = data;

  return (
    <DistributionChart
      items={results.map((t) => ({
        name: t.tag,
        count: t.count,
      }))}
      totalCount={totalCount}
      href={(item) => `/bottles?tag=${encodeURIComponent(item.name)}`}
    />
  );
}

export default function BottleTagDistribution(
  props: ComponentProps<typeof BottleTagDistributionElement>,
) {
  return (
    <div>
      <DistributionChartLegend>Common Notes</DistributionChartLegend>

      <ErrorBoundary fallback={<DistributionChartError />} onError={logError}>
        <Suspense fallback={<DistributionChartSkeleton />}>
          <BottleTagDistributionElement {...props} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
