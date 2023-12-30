import { type ExternalSiteSchema } from "@peated/server/src/schemas";
import { type ExternalSiteType } from "@peated/server/types";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, Outlet, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import type { SitemapFunction } from "remix-sitemap";
import invariant from "tiny-invariant";
import { type z } from "zod";
import Button from "../components/button";
import QueryBoundary from "../components/queryBoundary";
import Tabs from "../components/tabs";
import TimeSince from "../components/timeSince";
import { trpc } from "../lib/trpc";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export async function loader({
  params: { siteId },
  context: { trpc },
}: LoaderFunctionArgs) {
  invariant(siteId);

  const site = await trpc.externalSiteByType.query(siteId as ExternalSiteType);

  return json({ site });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [];

  return [
    {
      title: data.site.name,
    },
  ];
};

type UpdateSiteFn = (data: z.infer<typeof ExternalSiteSchema>) => void;

function TriggerJobButton({
  siteId,
  updateSite,
}: {
  siteId: ExternalSiteType;
  updateSite: UpdateSiteFn;
}) {
  const [isLoading, setLoading] = useState(false);
  const triggerJobMutation = trpc.externalSiteTriggerJob.useMutation({
    onSuccess: (data) => {
      updateSite(data);
    },
  });

  return (
    <Button
      color="primary"
      disabled={isLoading}
      loading={isLoading}
      onClick={async () => {
        setLoading(true);
        await triggerJobMutation.mutateAsync(siteId);
        setLoading(false);
      }}
    >
      Run Scraper Now
    </Button>
  );
}

export default function AdminSiteDetails() {
  const { site: initialSite } = useLoaderData<typeof loader>();
  const [site, setSite] = useState(initialSite);

  return (
    <div className="w-full p-3 lg:py-0">
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            to: "/admin",
          },
          {
            name: "External Sites",
            to: "/admin/sites",
          },
          {
            name: site.name,
            to: `/admin/sites/${site.type}`,
            current: true,
          },
        ]}
      />

      <div className="my-8 flex min-w-full flex-wrap gap-y-4 sm:flex-nowrap">
        <div className="flex w-full flex-col justify-center gap-y-4 px-4 sm:w-auto sm:flex-auto sm:gap-y-2">
          <h3 className="self-center text-4xl font-semibold leading-normal text-white sm:self-start">
            {site.name}
          </h3>
          <div className="text-light flex flex-col items-center self-center sm:flex-row sm:self-start">
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
              <span className="text-light text-sm">Last Run</span>
            </div>
            <div className="mb-4 px-3 text-center">
              <span className="block text-xl font-bold tracking-wide text-white">
                {site.nextRunAt ? (
                  <TimeSince date={site.nextRunAt} />
                ) : (
                  <>&mdash;</>
                )}
              </span>
              <span className="text-light text-sm">Next Run</span>
            </div>
            <div className="mb-4 px-3 text-center">
              <span className="block text-xl font-bold tracking-wide text-white">
                {site.runEvery ? `${site.runEvery} mins` : <>&mdash;</>}
              </span>
              <span className="text-light text-sm">Schedule</span>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col items-center justify-center sm:w-auto sm:items-end">
          <div className="flex gap-x-2">
            <TriggerJobButton
              siteId={site.type}
              updateSite={(d) => setSite(d)}
            />
          </div>
        </div>
      </div>

      <Tabs fullWidth border>
        <Tabs.Item as={Link} to={`/admin/sites/${site.type}`} controlled>
          Prices
        </Tabs.Item>
        <Tabs.Item
          as={Link}
          to={`/admin/sites/${site.type}/reviews`}
          controlled
        >
          Reviews
        </Tabs.Item>
      </Tabs>
      <QueryBoundary>
        <Outlet context={{ site }} />
      </QueryBoundary>
    </div>
  );
}
