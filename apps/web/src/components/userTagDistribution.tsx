"use client";

import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { logError } from "../lib/log";
import DistributionChart, {
  DistributionChartError,
  DistributionChartLegend,
  DistributionChartSkeleton,
} from "./distributionChart";

function UserTagDistributionElement({ userId }: { userId: number }) {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.users.tagList.queryOptions({
      input: {
        user: userId,
      },
    })
  );

  const { results, totalCount } = data;

  return (
    <DistributionChart
      items={results.map((t) => ({
        name: t.tag,
        count: t.count,
        tag: t.tag,
      }))}
      totalCount={totalCount}
      href={(item) => `/bottles?tag=${encodeURIComponent(item.name)}`}
    />
  );
}

export default function UserTagDistribution(
  props: ComponentProps<typeof UserTagDistributionElement>
) {
  return (
    <div>
      <DistributionChartLegend>Top Flavors</DistributionChartLegend>
      <ErrorBoundary fallback={<DistributionChartError />} onError={logError}>
        <Suspense fallback={<DistributionChartSkeleton />}>
          <UserTagDistributionElement {...props} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
