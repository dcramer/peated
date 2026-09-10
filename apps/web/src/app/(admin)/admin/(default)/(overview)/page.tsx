"use client";

import {
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
  const [scraperQuery, operationsQuery, inboxQuery] = useSuspenseQueries({
    queries: [
      orpc.admin.scraperActivity.queryOptions({ refetchInterval: 60_000 }),
      orpc.admin.moderation.automation.queryOptions({
        refetchInterval: 5_000,
      }),
      orpc.admin.moderation.listTasks.queryOptions({
        input: { limit: 1 },
        refetchOnMount: "always",
        staleTime: 0,
      }),
    ],
  });
  const scraperActivity = scraperQuery.data;
  const operations = operationsQuery.data;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Operations"
        description="Review open decisions, check background work, and track incoming data."
        metadata={
          <>
            Updated <TimeSince date={operations.generatedAt} />
          </>
        }
      />
      <OperationsOverview
        bottleResolution={scraperActivity.bottleResolution}
        data={operations}
        inboxCounts={inboxQuery.data.counts}
      />
      <ScraperActivity data={scraperActivity} />
    </AdminPage>
  );
}
