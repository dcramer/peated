"use client";

import type { Inputs } from "@peated/server/orpc/router";
import {
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminTable as Table } from "@peated/web/components/admin/adminTable.stylex";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

const DEFAULT_SORT: NonNullable<Inputs["countries"]["list"]>["sort"] = "name";

export default function Page() {
  const queryParams = useApiQueryParams({
    defaults: {
      sort: DEFAULT_SORT,
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
        defaultSort={DEFAULT_SORT}
        url={(item) => `/admin/locations/${item.slug}`}
        columns={[{ name: "name", sort: "name", sortDefaultOrder: "asc" }]}
        withSearch
      />
    </AdminPage>
  );
}
