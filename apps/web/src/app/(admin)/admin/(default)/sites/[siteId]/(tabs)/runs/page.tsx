"use client";

import { use } from "react";

import { type ExternalSiteKey } from "@peated/server/types";
import { AdminStatus } from "@peated/web/components/admin/adminContent.stylex";
import ExternalSiteRunTelemetry from "@peated/web/components/admin/externalSiteRunTelemetry";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Table from "@peated/web/components/table";
import TimeSince from "@peated/web/components/timeSince";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { formatDuration } from "@peated/web/lib/format";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

type Run = {
  status: "queued" | "running" | "succeeded" | "failed";
  startedAt: string | Date | null;
  completedAt: string | Date | null;
};

function runDuration(run: Run) {
  if (!run.startedAt || !run.completedAt) return "—";
  const duration =
    new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
  return duration < 1000 ? `${duration} ms` : formatDuration(duration);
}

export default function Page({
  params,
}: {
  params: Promise<{ siteId: ExternalSiteKey }>;
}) {
  const { siteId } = use(params);
  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
    overrides: { site: siteId },
  });
  const orpc = useORPC();
  const { data: runList } = useSuspenseQuery(
    orpc.externalSites.runs.queryOptions({ input: queryParams }),
  );

  return runList.results.length ? (
    <Table
      items={runList.results}
      rel={runList.rel}
      columns={[
        {
          name: "status",
          title: "Run",
          value: (run) => (
            <span>
              <AdminStatus
                tone={
                  run.status === "failed"
                    ? "danger"
                    : run.status === "running"
                      ? "warning"
                      : run.status === "queued"
                        ? "accent"
                        : "success"
                }
              >
                {run.status}
              </AdminStatus>{" "}
              · Run #{run.id} · {run.attemptCount} attempt
              {run.attemptCount === 1 ? "" : "s"}
              <ExternalSiteRunTelemetry run={run} />
              {run.error ? <div>{run.error}</div> : null}
            </span>
          ),
        },
        {
          name: "trigger",
          title: "Trigger",
          value: (run) => run.trigger,
        },
        { name: "queued", value: (run) => <TimeSince date={run.createdAt} /> },
        { name: "duration", value: runDuration },
      ]}
    />
  ) : (
    <EmptyActivity>No scraper runs have been recorded yet.</EmptyActivity>
  );
}
