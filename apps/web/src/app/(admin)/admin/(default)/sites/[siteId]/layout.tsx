"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { ExternalSiteTypeEnum } from "@peated/server/schemas/externalSites";
import ExternalSiteRunStatus from "@peated/web/components/admin/externalSiteRunStatus";
import ScraperReadiness from "@peated/web/components/admin/scraperReadiness";
import { getScraperRunAvailability } from "@peated/web/components/admin/scraperRunAvailability";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import TimeSince from "@peated/web/components/timeSince";
import { formatDuration } from "@peated/web/lib/format";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { use, useState, type ReactNode } from "react";

type Site = Outputs["externalSites"]["healthDetails"];

function TriggerJobButton({ site }: { site: Site }) {
  const [isLoading, setLoading] = useState(false);
  const availability = getScraperRunAvailability(site);
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const triggerJobMutation = useMutation(
    orpc.externalSites.triggerJob.mutationOptions(),
  );

  return (
    <Button
      disabled={isLoading || availability !== null}
      loading={isLoading}
      title={availability?.reason}
      onClick={async () => {
        setLoading(true);
        try {
          await triggerJobMutation.mutateAsync({ site: site.type });
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: orpc.externalSites.healthList.key(),
            }),
            queryClient.invalidateQueries({
              queryKey: orpc.externalSites.healthDetails.key({
                input: { site: site.type },
              }),
            }),
            queryClient.invalidateQueries({
              queryKey: orpc.externalSites.runs.key(),
            }),
          ]);
        } finally {
          setLoading(false);
        }
      }}
    >
      {availability?.label ?? "Run Scraper Now"}
    </Button>
  );
}

export default function Layout(props: {
  params: Promise<{ siteId: string }>;
  children: ReactNode;
}) {
  const params = use(props.params);

  const { siteId } = params;

  const { children } = props;

  const orpc = useORPC();
  const { data: site } = useSuspenseQuery(
    orpc.externalSites.healthDetails.queryOptions({
      input: {
        site: ExternalSiteTypeEnum.parse(siteId),
      },
    }),
  );

  return (
    <div className="w-full p-3 lg:py-0">
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
          },
          {
            name: "Scrapers",
            href: "/admin/sites",
          },
          {
            name: site.name,
            href: `/admin/sites/${site.type}`,
            current: true,
          },
        ]}
      />

      <div className="my-6 flex min-w-full flex-wrap gap-y-5 sm:flex-nowrap">
        <div className="flex w-full flex-col justify-center px-4 sm:w-auto sm:flex-auto">
          <h1 className="self-center text-3xl font-semibold text-white sm:self-start sm:text-4xl">
            {site.name}
          </h1>
          <div className="text-muted mt-2 self-center sm:self-start">
            {site.type}
          </div>
          <div className="mt-3 self-center text-sm sm:self-start">
            <ExternalSiteRunStatus site={site} />
          </div>
          <dl className="mt-5 grid w-full max-w-2xl grid-cols-2 divide-x divide-slate-800 self-center sm:grid-cols-4 sm:self-start">
            <div className="flex flex-col px-3 text-center first:pl-0 sm:text-left">
              <dt className="text-muted order-2 text-xs sm:text-sm">
                External reviews
              </dt>
              <dd className="order-1 text-lg font-bold tracking-wide text-white">
                {site.externalReviews.matched.toLocaleString("en-US")} /{" "}
                {site.externalReviews.total.toLocaleString("en-US")}
              </dd>
            </div>
            <div className="flex flex-col px-3 text-center sm:text-left">
              <dt className="text-muted order-2 text-xs sm:text-sm">Prices</dt>
              <dd className="order-1 text-lg font-bold tracking-wide text-white">
                {site.priceListings.matched.toLocaleString("en-US")} /{" "}
                {site.priceListings.total.toLocaleString("en-US")}
              </dd>
            </div>
            <div className="flex flex-col border-t border-slate-800 px-3 pt-3 text-center sm:border-t-0 sm:pt-0 sm:text-left">
              <dt className="text-muted order-2 text-xs sm:text-sm">
                Schedule
              </dt>
              <dd className="order-1 text-sm font-bold text-white sm:text-base">
                {site.runEvery
                  ? formatDuration(site.runEvery * 60 * 1000)
                  : "Manual only"}
              </dd>
            </div>
            <div className="flex flex-col border-t border-slate-800 px-3 pt-3 text-center last:pr-0 sm:border-t-0 sm:pt-0 sm:text-left">
              <dt className="text-muted order-2 text-xs sm:text-sm">
                Next Run
              </dt>
              <dd className="order-1 text-sm font-bold text-white sm:text-base">
                {site.nextRunAt ? (
                  <TimeSince date={site.nextRunAt} />
                ) : site.runEvery !== null ? (
                  "Due now"
                ) : (
                  "Not scheduled"
                )}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex w-full flex-col items-center justify-center sm:w-auto sm:items-end">
          <div className="flex gap-x-2">
            <TriggerJobButton site={site} />
          </div>
        </div>
      </div>

      <ScraperReadiness site={site} />

      <Tabs border>
        <TabItem as={Link} href={`/admin/sites/${site.type}`} controlled>
          Prices
        </TabItem>
        <TabItem
          as={Link}
          href={`/admin/sites/${site.type}/external-reviews`}
          controlled
        >
          External reviews
        </TabItem>
        <TabItem as={Link} href={`/admin/sites/${site.type}/runs`} controlled>
          Runs
        </TabItem>
      </Tabs>

      {children}
    </div>
  );
}
