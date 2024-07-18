"use client";

import { formatCategoryName } from "@peated/server/lib/format";
import { trpc } from "../lib/trpc/client";
import { DistributionChart } from "./distributionChart";

export default function EntitySpiritDistribution({
  entityId,
}: {
  entityId: number;
}) {
  const [data] = trpc.entityCategoryList.useSuspenseQuery({
    entity: entityId,
  });

  const { results, totalCount } = data;

  if (!results.length) return null;

  return (
    <DistributionChart
      items={results.map((t) => ({
        name: formatCategoryName(t.category),
        count: t.count,
        category: t.category,
      }))}
      totalCount={totalCount}
      href={(item) =>
        `/bottles?entity=${entityId}&category=${encodeURIComponent(
          item.category,
        )}`
      }
    />
  );
}
