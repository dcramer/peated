"use client";

import { use, useState, type ReactNode } from "react";

import type { Outputs } from "@peated/server/orpc/router";
import { ExternalSiteKeySchema } from "@peated/server/schemas/externalSites";
import { PageTabs } from "@peated/web/components";
import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminActions,
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
  AdminStat,
  AdminStatGrid,
} from "@peated/web/components/admin/adminContent.stylex";
import { ExternalSiteIdentity } from "@peated/web/components/admin/externalSiteIcon.stylex";
import ExternalSiteRunStatus from "@peated/web/components/admin/externalSiteRunStatus";
import { getScraperRunAvailability } from "@peated/web/components/admin/scraperRunAvailability";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { usePathname } from "next/navigation";

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
      {availability?.label ?? "Run scraper now"}
    </Button>
  );
}

export default function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = use(params);
  const pathname = usePathname();
  const orpc = useORPC();
  const { data: site } = useSuspenseQuery(
    orpc.externalSites.healthDetails.queryOptions({
      input: {
        site: ExternalSiteKeySchema.parse(siteId),
      },
    }),
  );
  const root = `/admin/sites/${site.type}`;

  return (
    <AdminPage>
      <AdminBreadcrumbs
        items={[
          { label: "Scrapers", href: "/admin/sites" },
          { label: site.name, href: root, current: true },
        ]}
      />
      <AdminPageHeader
        title={
          <ExternalSiteIdentity
            imageUrl={site.imageUrl}
            name={site.name}
            size="lg"
          />
        }
        eyebrow={site.type}
        metadata={<ExternalSiteRunStatus site={site} />}
        actions={
          <AdminActions>
            <TriggerJobButton site={site} />
          </AdminActions>
        }
      />
      <AdminStatGrid>
        <AdminStat
          label="Reviews"
          value={`${site.externalReviews.matched.toLocaleString("en-US")} / ${site.externalReviews.total.toLocaleString("en-US")}`}
        />
        <AdminStat
          label="Prices"
          value={`${site.priceListings.matched.toLocaleString("en-US")} / ${site.priceListings.total.toLocaleString("en-US")}`}
        />
      </AdminStatGrid>
      <PageTabs
        ariaLabel="Scraper"
        currentHref={pathname}
        items={[
          { href: root, label: "Settings" },
          { href: `${root}/runs`, label: "Runs" },
          { href: `${root}/prices`, label: "Prices" },
          { href: `${root}/reviews`, label: "Reviews" },
        ]}
      />
      {children}
    </AdminPage>
  );
}
