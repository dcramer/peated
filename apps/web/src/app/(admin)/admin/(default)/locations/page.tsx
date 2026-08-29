"use client";

import {
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminTable as Table } from "@peated/web/components/admin/adminTable.stylex";
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
    <AdminPage>
      <AdminBreadcrumbs
        items={[
          {
            label: "Admin",
            href: "/admin",
          },
          {
            label: "Locations",
            href: "/admin/locations",
            current: true,
          },
        ]}
      />
      <AdminPageHeader title="Locations" />

      <Table
        items={countryList.results}
        rel={countryList.rel}
        defaultSort="-created"
        url={(item) => `/admin/locations/${item.slug}`}
        columns={[{ name: "name", sort: "name", sortDefaultOrder: "asc" }]}
        withSearch
      />
    </AdminPage>
  );
}
