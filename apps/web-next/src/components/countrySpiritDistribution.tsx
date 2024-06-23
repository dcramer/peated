"use client";

import { formatCategoryName } from "@peated/server/src/lib/format";
import { trpc } from "../lib/trpc";
import { DistributionChart } from "./distributionChart";

export default function CountrySpiritDistribution({
  countrySlug,
}: {
  countrySlug: string;
}) {
  const [data] = trpc.countryCategoryList.useSuspenseQuery({
    country: countrySlug,
  });

  const { results, totalCount } = data;

  if (!results.length) return null;

  // TODO: links need country
  return (
    <DistributionChart
      items={results.map((t) => ({
        name: formatCategoryName(t.category),
        count: t.count,
        category: t.category,
      }))}
      totalCount={totalCount}
      href={(item) => `/bottles?category=${encodeURIComponent(item.category)}`}
    />
  );
}
