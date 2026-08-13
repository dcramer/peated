"use client";

import ExternalSiteRunStatus from "@peated/web/components/admin/externalSiteRunStatus";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
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
    orpc.externalSites.healthList.queryOptions({
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
      {siteList.results.length > 0 ? (
        <Table
          items={siteList.results}
          rel={siteList.rel}
          defaultSort="name"
          primaryKey={(item) => item.type}
          url={(item) => `/admin/sites/${item.type}`}
          columns={[
            {
              name: "name",
              sort: "name",
              sortDefaultOrder: "asc",
              value: (site) => (
                <div>
                  <div>{site.name}</div>
                  <div className="text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:hidden">
                    <span>
                      {site.listingCount.toLocaleString("en-US")} listings
                    </span>
                    <ExternalSiteRunStatus site={site} compact />
                  </div>
                </div>
              ),
            },
            {
              name: "listingCount",
              title: "Listings",
              align: "right",
              className: "hidden w-32 sm:table-column",
              value: (site) => site.listingCount.toLocaleString("en-US"),
            },
            {
              name: "status",
              title: "Status",
              className: "hidden w-72 sm:table-column",
              value: (site) => <ExternalSiteRunStatus site={site} />,
            },
            {
              name: "nextRunAt",
              title: "Next Run",
              className: "hidden w-32 sm:table-column",
              value: (site) =>
                site.nextRunAt ? (
                  <TimeSince date={site.nextRunAt} />
                ) : (
                  <>&mdash;</>
                ),
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
