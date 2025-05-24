"use client";

import { formatFlavorProfile } from "@peated/server/lib/format";
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

function UserFlavorDistributionElement({ userId }: { userId: number }) {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.users.flavorList.queryOptions({
      input: {
        user: userId,
      },
    }),
  );

  const { results, totalCount } = data;

  return (
    <DistributionChart
      items={results.map((t) => ({
        name: formatFlavorProfile(t.flavorProfile),
        count: t.count,
        flavorProfile: t.flavorProfile,
      }))}
      totalCount={totalCount}
      href={(item) =>
        `/bottles?flavorProfile=${encodeURIComponent(item.flavorProfile)}`
      }
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
