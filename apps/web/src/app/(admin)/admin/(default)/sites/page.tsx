"use client";

import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminActions,
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import { AdminTable as Table } from "@peated/web/components/admin/adminTable.stylex";
import { AdminEmptyActivity as EmptyActivity } from "@peated/web/components/admin/adminUtility.stylex";
import { ExternalSiteIdentity } from "@peated/web/components/admin/externalSiteIcon.stylex";
import ScraperDashboardSummary from "@peated/web/components/admin/scraperDashboardSummary.stylex";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import * as stylex from "@stylexjs/stylex";
import { useSuspenseQueries } from "@tanstack/react-query";

import { foundationStyles } from "../../../../../styles/foundations.stylex";
import {
  ScraperRecordCount,
  ScraperRunSummary,
} from "./scraperIndexCell.stylex";

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
      <AdminPageHeader
        title="Scrapers"
        description="Check what each source has saved and what needs attention."
        actions={
          <AdminActions>
            <Button href="/admin/sites/add" variant="accent">
              Add site
            </Button>
          </AdminActions>
        }
      />
      <ScraperDashboardSummary coverage={coverage} health={siteList.summary} />
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
              fill: true,
              showOnMobile: true,
              sort: "name",
              sortDefaultOrder: "asc",
              value: (site) => (
                <ExternalSiteIdentity
                  imageUrl={site.imageUrl}
                  name={site.name}
                  size="sm"
                >
                  <span {...stylex.props(foundationStyles.compactRowTitle)}>
                    {site.name}
                  </span>
                </ExternalSiteIdentity>
              ),
            },
            {
              align: "left",
              name: "catalogListings",
              showOnMobile: true,
              title: "Catalog",
              value: (site) => (
                <ScraperRecordCount total={site.catalogListings.total} />
              ),
            },
            {
              align: "left",
              name: "externalReviews",
              showOnMobile: true,
              title: "Reviews",
              value: (site) => (
                <ScraperRecordCount
                  total={site.externalReviews.total}
                  unmatched={site.externalReviews.unmatched}
                />
              ),
            },
            {
              align: "left",
              name: "priceListings",
              showOnMobile: true,
              title: "Prices",
              value: (site) => (
                <ScraperRecordCount
                  total={site.priceListings.total}
                  unmatched={site.priceListings.unmatched}
                />
              ),
            },
            {
              align: "left",
              name: "run",
              showOnMobile: true,
              title: "Run",
              value: (site) => <ScraperRunSummary site={site} />,
            },
          ]}
          withSearch
        />
      ) : (
        <EmptyActivity>No scrapers are configured.</EmptyActivity>
      )}
    </AdminPage>
  );
}
