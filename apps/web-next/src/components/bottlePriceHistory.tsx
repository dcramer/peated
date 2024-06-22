"use client";

import { trpc } from "@peated/web/lib/trpc";
import { ClientOnly } from "./clientOnly";
import { RangeBarChart } from "./rangeBarChart.client";

export function BottlePriceHistorySkeleton() {
  return <div className="h-[45px] animate-pulse" />;
}

export default function BottlePriceHistory({ bottleId }: { bottleId: number }) {
  const [data] = trpc.bottlePriceHistory.useSuspenseQuery({
    bottle: bottleId,
  });

  const points = data.results.reverse().map((r, idx) => {
    return { time: idx, high: r.maxPrice, low: r.minPrice, avg: r.avgPrice };
  });

  return (
    <ClientOnly fallback={<div className="h-[45px] animate-pulse" />}>
      {() => <RangeBarChart data={points} width={200} height={45} />}
    </ClientOnly>
  );
}
