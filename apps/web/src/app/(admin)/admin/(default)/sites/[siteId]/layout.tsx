"use client";

import type { ExternalSiteSchema } from "@peated/server/schemas";
import type { ExternalSiteType } from "@peated/server/types";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import TimeSince from "@peated/web/components/timeSince";
import { formatDuration } from "@peated/web/lib/format";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import type { z } from "zod";

function TriggerJobButton({ siteId }: { siteId: ExternalSiteType }) {
  const [isLoading, setLoading] = useState(false);
  const orpc = useORPC();
  const triggerJobMutation = useMutation(
    orpc.externalSites.triggerJob.mutationOptions()
  );

  return (
    <Button
      disabled={isLoading}
      loading={isLoading}
      onClick={async () => {
        setLoading(true);
        await triggerJobMutation.mutateAsync({
          site: siteId,
        });
        setLoading(false);
      }}
    >
      Run Scraper Now
    </Button>
  );
}

export default function Layout({
  params: { siteId },
  children,
}: {
  params: { siteId: string };
  children: ReactNode;
}) {
  const orpc = useORPC();
  const { data: initialSite } = useSuspenseQuery(
    orpc.externalSites.details.queryOptions({
      input: {
        site: siteId as ExternalSiteType,
      },
    })
  );

  const [site, setSite] = useState(initialSite);

  return (
    <div className="w-full p-3 lg:py-0">
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            href: "/admin",
          },
          {
            name: "External Sites",
            href: "/admin/sites",
          },
          {
            name: site.name,
            href: `/admin/sites/${site.type}`,
            current: true,
          },
        ]}
      />

      <div className="my-8 flex min-w-full flex-wrap gap-y-4 sm:flex-nowrap">
        <div className="flex w-full flex-col justify-center gap-y-4 px-4 sm:w-auto sm:flex-auto sm:gap-y-2">
          <h3 className="self-center text-4xl font-semibold text-white sm:self-start">
            {site.name}
          </h3>
          <div className="text-muted flex flex-col items-center self-center sm:flex-row sm:self-start lg:mb-8">
            {site.type}
          </div>
          <div className="flex justify-center sm:justify-start">
            <div className="mr-4 pr-3 text-center">
              <span className="racking-wide block text-xl  font-bold text-white">
                {site.lastRunAt ? (
                  <TimeSince date={site.lastRunAt} />
                ) : (
                  <>&mdash;</>
                )}
              </span>
              <span className="text-muted text-sm">Last Run</span>
            </div>
            <div className="mb-4 px-3 text-center">
              <span className="block text-xl font-bold tracking-wide text-white">
                {site.nextRunAt ? (
                  <TimeSince date={site.nextRunAt} />
                ) : (
                  <>&mdash;</>
                )}
              </span>
              <span className="text-muted text-sm">Next Run</span>
            </div>
            <div className="mb-4 px-3 text-center">
              <span className="block text-xl font-bold tracking-wide text-white">
                {site.runEvery ? (
                  formatDuration(site.runEvery * 60 * 1000)
                ) : (
                  <>&mdash;</>
                )}
              </span>
              <span className="text-muted text-sm">Schedule</span>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col items-center justify-center sm:w-auto sm:items-end">
          <div className="flex gap-x-2">
            <Button href={`/admin/sites/${site.type}/edit`}>Edit Site</Button>
            <TriggerJobButton siteId={site.type} />
          </div>
        </div>
      </div>

      <Tabs border>
        <TabItem as={Link} href={`/admin/sites/${site.type}`} controlled>
          Prices
        </TabItem>
        <TabItem
          as={Link}
          href={`/admin/sites/${site.type}/reviews`}
          controlled
        >
          Reviews
        </TabItem>
      </Tabs>

      {children}
    </div>
  );
}
