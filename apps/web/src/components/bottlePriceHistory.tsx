"use client";

import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { RangeBarChart } from "./rangeBarChart.client";

export function BottlePriceHistorySkeleton() {
  return <div className="h-[45px] animate-pulse bg-slate-800" />;
}

export default function BottlePriceHistory({ bottleId }: { bottleId: number }) {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.bottles.prices.history.queryOptions({
      input: { bottle: bottleId },
    }),
  );

  if (typeof window === "undefined") {
    return <BottlePriceHistorySkeleton />;
  }

  const points = data.results.reverse().map((r, idx) => {
    return { time: idx, high: r.maxPrice, low: r.minPrice, avg: r.avgPrice };
  });

  return <RangeBarChart data={points} width={200} height={45} />;
}
