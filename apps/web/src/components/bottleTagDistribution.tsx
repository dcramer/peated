"use client";

import { trpc } from "@peated/web/lib/trpc";
import { DistributionChart } from "./distributionChart";

export function BottleTagDistributionSkeleton() {
  return <div className="animate-pulse bg-slate-800" style={{ height: 120 }} />;
}

export default function BottleTagDistribution({
  bottleId,
}: {
  bottleId: number;
}) {
  const [data] = trpc.bottleTagList.useSuspenseQuery({
    bottle: bottleId,
  });

  const { results, totalCount } = data;

  if (!results.length) return null;

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
