"use client";

import Table from "@peated/web/components/table";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { trpc } from "@peated/web/lib/trpc/client";

export default function Page({
  params: { countrySlug },
}: {
  params: { countrySlug: string };
}) {
  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
    overrides: {
      country: countrySlug,
      sort: "-bottles",
      limit: 100,
    },
  });

  const [[regionList]] = trpc.useSuspenseQueries((t) => [
    t.regionList(queryParams),
  ]);

  return (
    <Table
      items={regionList.results}
      rel={regionList.rel}
      defaultSort="-bottles"
      url={(item) => `/locations/${countrySlug}/regions/${item.slug}`}
      columns={[
        { name: "name", sort: "name", sortDefaultOrder: "asc" },
        {
          name: "totalBottles",
          title: "Bottles",
          sort: "bottles",
        },
        {
          name: "totalDistillers",
          title: "Distillers",
          sort: "distillers",
        },
      ]}
    />
  );
}
