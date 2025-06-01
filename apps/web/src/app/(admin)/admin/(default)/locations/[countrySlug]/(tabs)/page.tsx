"use client";

import Table from "@peated/web/components/table";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page({
  params: { countrySlug },
}: {
  params: { countrySlug: string };
}) {
  const queryParams = useApiQueryParams({
    defaults: {
      sort: "-created",
    },
    numericFields: ["cursor", "limit"],
    overrides: {
      country: countrySlug,
    },
  });

  const orpc = useORPC();
  const { data: regionList } = useSuspenseQuery(
    orpc.regions.list.queryOptions({
      input: {
        country: countrySlug,
        ...queryParams,
      },
    })
  );

  return (
    <div>
      <Table
        items={regionList.results}
        rel={regionList.rel}
        defaultSort="-created"
        url={(item) => `/admin/locations/${countrySlug}/regions/${item.slug}`}
        columns={[{ name: "name", sort: "name", sortDefaultOrder: "asc" }]}
      />
    </div>
  );
}
