import { trpc } from "@peated/web/lib/trpc";
import { RangeBarChart } from "./rangeBarChart.client";

export default function BottlePriceHistory({ bottleId }: { bottleId: number }) {
  const { data, isLoading } = trpc.bottlePriceHistory.useQuery({
    bottle: bottleId,
  });

  if (isLoading) return <div className="h-[45px] animate-pulse" />;

  if (!data) return <div className="h-[45px] animate-pulse" />;

  const points = data.results.reverse().map((r, idx) => {
    return { time: idx, high: r.maxPrice, low: r.minPrice, avg: r.avgPrice };
  });

  return <RangeBarChart data={points} width={200} height={45} />;
}
