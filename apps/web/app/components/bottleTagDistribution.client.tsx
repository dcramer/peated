import { trpc } from "../lib/trpc";
import { DistributionChart } from "./distributionChart";

export default function BottleTagDistribution({
  bottleId,
}: {
  bottleId: number;
}) {
  const { data } = trpc.bottleTagList.useQuery({
    bottle: bottleId,
  });

  if (!data) return null;

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
      to={(item) => `/bottles?tag=${encodeURIComponent(item.name)}`}
    />
  );
}
