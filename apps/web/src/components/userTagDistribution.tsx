"use client";

import { trpc } from "@peated/web/lib/trpc/client";
import { DistributionChart } from "./distributionChart";

export default function UserTagDistribution({ userId }: { userId: number }) {
  const [data] = trpc.userTagList.useSuspenseQuery({
    user: userId,
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
