"use client";

import ExternalSiteRunStatus from "@peated/web/components/admin/externalSiteRunStatus";
import ScraperCatalogCoverage from "@peated/web/components/admin/scraperCatalogCoverage";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Table from "@peated/web/components/table";
import TimeSince from "@peated/web/components/timeSince";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQueries } from "@tanstack/react-query";

export default function Page() {
  const queryParams = useApiQueryParams({
    defaults: {
      sort: "name",
    },
    numericFields: ["cursor", "limit"],
  });

  const orpc = useORPC();
  const [siteQuery, coverageQuery] = useSuspenseQueries({
    queries: [
      orpc.externalSites.healthList.queryOptions({ input: queryParams }),
      orpc.admin.catalogCoverage.queryOptions(),
    ],
  });
  const siteList = siteQuery.data;
  const coverage = coverageQuery.data;

  return (
    <div>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
          },
          {
            name: "Scrapers",
            href: "/admin/sites",
            current: true,
          },
        ]}
      />
      <ScraperCatalogCoverage coverage={coverage} />
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
                      {site.reviews.total.toLocaleString("en-US")} reviews
                    </span>
                    <span>
                      {site.priceListings.total.toLocaleString("en-US")} prices
                    </span>
                    <ExternalSiteRunStatus site={site} compact />
                  </div>
                </div>
              ),
            },
            {
              name: "inventory",
              title: "Inventory",
              className: "hidden w-48 sm:table-column",
              value: (site) => (
                <div className="space-y-1 text-sm">
                  <div>
                    {site.reviews.total.toLocaleString("en-US")} reviews
                    <span className="text-muted ml-2 text-xs">
                      {site.reviews.matched.toLocaleString("en-US")} matched
                    </span>
                  </div>
                  <div>
                    {site.priceListings.total.toLocaleString("en-US")} prices
                    <span className="text-muted ml-2 text-xs">
                      {site.priceListings.matched.toLocaleString("en-US")}{" "}
                      matched
                    </span>
                  </div>
                </div>
              ),
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
                ) : site.runEvery === null ? (
                  "Manual only"
                ) : (
                  "Due now"
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
