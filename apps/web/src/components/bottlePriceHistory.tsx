"use client";

import { trpc } from "@peated/web/lib/trpc";
import { RangeBarChart } from "./rangeBarChart.client";

export function BottlePriceHistorySkeleton() {
  return <div className="h-[45px] animate-pulse bg-slate-800" />;
}

export default function BottlePriceHistory({ bottleId }: { bottleId: number }) {
  const [data] = trpc.bottlePriceHistory.useSuspenseQuery({
    bottle: bottleId,
  });

  if (typeof window === "undefined") {
    return <BottlePriceHistorySkeleton />;
  }

  const points = data.results.reverse().map((r, idx) => {
    return { time: idx, high: r.maxPrice, low: r.minPrice, avg: r.avgPrice };
  });

  return <RangeBarChart data={points} width={200} height={45} />;
}
