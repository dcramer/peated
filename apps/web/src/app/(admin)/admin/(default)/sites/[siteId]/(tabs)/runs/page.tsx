"use client";

import { type ExternalSiteKey } from "@peated/server/types";
import ExternalSiteRunTelemetry from "@peated/web/components/admin/externalSiteRunTelemetry";
import EmptyActivity from "@peated/web/components/emptyActivity";
import PaginationButtons from "@peated/web/components/paginationButtons";
import Table from "@peated/web/components/table";
import TimeSince from "@peated/web/components/timeSince";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import classNames from "@peated/web/lib/classNames";
import { formatDuration } from "@peated/web/lib/format";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { use } from "react";

type Run = {
  status: "queued" | "running" | "succeeded" | "failed";
  startedAt: string | Date | null;
  completedAt: string | Date | null;
};

function RunStatus({ status }: Pick<Run, "status">) {
  const colors = {
    queued: "bg-sky-400",
    running: "bg-amber-400",
    succeeded: "bg-green-400",
    failed: "bg-red-400",
  } as const;

  return (
    <span className="inline-flex items-center gap-2 font-medium capitalize">
      <span
        aria-hidden="true"
        className={classNames("h-2 w-2 rounded-full", colors[status])}
      />
      {status}
    </span>
  );
}

function runDuration(run: Run) {
  if (!run.startedAt || !run.completedAt) return "—";

  const duration =
    new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
  return duration < 1000 ? `${duration} ms` : formatDuration(duration);
}

export default function Page(props: {
  params: Promise<{ siteId: ExternalSiteKey }>;
}) {
  const { siteId } = use(props.params);
  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
    overrides: { site: siteId },
  });
  const orpc = useORPC();
  const { data: runList } = useSuspenseQuery(
    orpc.externalSites.runs.queryOptions({ input: queryParams }),
  );

  return runList.results.length > 0 ? (
    <>
      <div className="divide-y divide-slate-800 sm:hidden">
        {runList.results.map((run) => (
          <article key={run.id} className="px-3 py-4">
            <div className="flex items-start justify-between gap-4">
              <RunStatus status={run.status} />
              <span className="text-muted shrink-0 text-xs">
                <TimeSince date={run.createdAt} />
              </span>
            </div>
            <div className="text-muted mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <span>Run #{run.id}</span>
              <span className="capitalize">{run.trigger}</span>
              <span>
                {run.attemptCount} attempt
                {run.attemptCount === 1 ? "" : "s"}
              </span>
              <span>{runDuration(run)}</span>
            </div>
            <ExternalSiteRunTelemetry run={run} />
            {run.error ? (
              <div className="mt-3 rounded-md border border-red-900/70 bg-red-950/30 px-3 py-2 text-xs text-red-200">
                {run.error}
              </div>
            ) : null}
          </article>
        ))}
        <PaginationButtons rel={runList.rel} />
      </div>
      <div className="hidden sm:block">
        <Table
          items={runList.results}
          rel={runList.rel}
          columns={[
            {
              name: "status",
              title: "Run",
              value: (run) => (
                <div>
                  <RunStatus status={run.status} />
                  <div className="text-muted mt-1 text-xs">
                    Run #{run.id} · {run.attemptCount} attempt
                    {run.attemptCount === 1 ? "" : "s"}
                  </div>
                  <ExternalSiteRunTelemetry run={run} />
                  {run.error ? (
                    <div className="mt-2 text-xs text-red-300">{run.error}</div>
                  ) : null}
                </div>
              ),
            },
            {
              name: "trigger",
              title: "Trigger",
              value: (run) => <span className="capitalize">{run.trigger}</span>,
            },
            {
              name: "createdAt",
              title: "Queued",
              className: "w-40",
              cellClassName: "whitespace-nowrap",
              value: (run) => <TimeSince date={run.createdAt} />,
            },
            {
              name: "duration",
              title: "Duration",
              className: "w-36",
              cellClassName: "whitespace-nowrap",
              value: (run) => runDuration(run),
            },
          ]}
        />
      </div>
    </>
  ) : (
    <EmptyActivity>No scraper runs have been recorded yet.</EmptyActivity>
  );
}
