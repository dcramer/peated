"use client";

import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Table from "@peated/web/components/table";
import TimeSince from "@peated/web/components/timeSince";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page() {
  const queryParams = useApiQueryParams({
    defaults: {
      sort: "name",
    },
    numericFields: ["cursor", "limit"],
  });

  const orpc = useORPC();
  const { data: siteList } = useSuspenseQuery(
    orpc.externalSites.list.queryOptions({
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
            name: "Sites",
            href: "/admin/sites",
            current: true,
          },
        ]}
      />
      <div className="flex items-center justify-end">
        <Button color="primary" href="/admin/sites/add">
          Add Site
        </Button>
      </div>

      {siteList.results.length > 0 ? (
        <Table
          items={siteList.results}
          rel={siteList.rel}
          defaultSort="-created"
          primaryKey={(item) => item.type}
          url={(item) => `/admin/sites/${item.type}`}
          columns={[
            { name: "name", sort: "name", sortDefaultOrder: "asc" },
            {
              name: "lastRunAt",
              title: "Last Run",
              value: (v) =>
                v.lastRunAt ? <TimeSince date={v.lastRunAt} /> : <>&mdash;</>,
            },
          ]}
        />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </div>
  );
}
