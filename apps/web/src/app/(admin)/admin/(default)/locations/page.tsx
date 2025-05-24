"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Table from "@peated/web/components/table";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page() {
  const queryParams = useApiQueryParams({
    defaults: {
      sort: "-created",
    },
    numericFields: ["cursor", "limit"],
  });

  const orpc = useORPC();
  const { data: countryList } = useSuspenseQuery(
    orpc.countries.list.queryOptions({
      input: queryParams,
    }),
  );

  return (
    <div>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
          },
          {
            name: "Locations",
            href: "/admin/locations",
            current: true,
          },
        ]}
      />

      <Table
        items={countryList.results}
        rel={countryList.rel}
        defaultSort="-created"
        url={(item) => `/admin/locations/${item.slug}`}
        columns={[{ name: "name", sort: "name", sortDefaultOrder: "asc" }]}
        withSearch
      />
    </div>
  );
}
