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

function BottleTagDistributionElement({ bottleId }: { bottleId: number }) {
  const [data] = trpc.bottleTagList.useSuspenseQuery({
    bottle: bottleId,
  });

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
