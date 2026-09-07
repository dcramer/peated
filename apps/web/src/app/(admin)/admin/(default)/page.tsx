"use client";

import {
  AdminBreadcrumbs,
  AdminPage,
  AdminPageHeader,
} from "@peated/web/components/admin/adminContent.stylex";
import OperationsOverview from "@peated/web/components/admin/operationsOverview.stylex";
import ScraperActivity from "@peated/web/components/admin/scraperActivity.stylex";
import TimeSince from "@peated/web/components/timeSince";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQueries } from "@tanstack/react-query";

export default function Page() {
  const orpc = useORPC();
  const [scraperQuery, operationsQuery] = useSuspenseQueries({
    queries: [
      orpc.admin.scraperActivity.queryOptions({ refetchInterval: 60_000 }),
      orpc.admin.moderation.automation.queryOptions({
        refetchInterval: 5_000,
      }),
    ],
  });
  const scraperActivity = scraperQuery.data;
  const operations = operationsQuery.data;

  return (
    <AdminPage>
      <AdminBreadcrumbs
        items={[{ label: "Overview", href: "/admin", current: true }]}
      />
      <AdminPageHeader
        title="Operations"
        description="See what Peated is processing and what needs attention."
        metadata={
          <>
            Updated <TimeSince date={operations.generatedAt} />
          </>
        }
      />
      <OperationsOverview
        bottleResolution={scraperActivity.bottleResolution}
        data={operations}
      />
      <ScraperActivity data={scraperActivity} />
    </AdminPage>
  );
}
