"use client";

import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminActions,
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminTable as Table } from "@peated/web/components/admin/adminTable.stylex";
import { AdminEmptyActivity as EmptyActivity } from "@peated/web/components/admin/adminUtility.stylex";
import ExternalSiteRunStatus from "@peated/web/components/admin/externalSiteRunStatus";
import ScraperCatalogCoverage from "@peated/web/components/admin/scraperCatalogCoverage";
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
    <AdminPage>
      <AdminBreadcrumbs
        items={[{ label: "Scrapers", href: "/admin/sites", current: true }]}
      />
      <AdminPageHeader
        title="Scrapers"
        actions={
          <AdminActions>
            <Button href="/admin/sites/add" color="highlight">
              Add site
            </Button>
          </AdminActions>
        }
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
              value: (site) => site.name,
            },
            {
              name: "inventory",
              title: "Inventory",
              value: (site) =>
                `${site.externalReviews.matched.toLocaleString("en-US")} / ${site.externalReviews.total.toLocaleString("en-US")} reviews · ${site.priceListings.matched.toLocaleString("en-US")} / ${site.priceListings.total.toLocaleString("en-US")} prices`,
            },
            {
              name: "status",
              title: "Status",
              value: (site) => <ExternalSiteRunStatus site={site} />,
            },
            {
              name: "nextRunAt",
              title: "Next Run",
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
        <EmptyActivity>No scrapers are configured.</EmptyActivity>
      )}
    </AdminPage>
  );
}
