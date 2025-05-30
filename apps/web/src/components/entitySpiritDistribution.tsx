"use client";

import { formatCategoryName } from "@peated/server/lib/format";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import DistributionChart from "./distributionChart";

export default function EntitySpiritDistribution({
  entityId,
}: {
  entityId: number;
}) {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.entities.categories.list.queryOptions({
      input: { entity: entityId },
    }),
  );

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
