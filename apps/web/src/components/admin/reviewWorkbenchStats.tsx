import type { Outputs } from "@peated/server/orpc/router";

type ReviewWorkbenchStats = Outputs["admin"]["reviewWorkbenchStats"];

function formatCount(value: null | number | undefined) {
  if (value === undefined) {
    return "...";
  }

  if (value === null) {
    return "\u2014";
  }

  return value.toLocaleString();
}

function formatHours(value: null | number | undefined) {
  if (value === undefined) {
    return "...";
  }

  if (value === null) {
    return "\u2014";
  }

  if (value >= 48) {
    return `${(value / 24).toFixed(1)}d`;
  }

  return `${value.toFixed(1)}h`;
}

function SnapshotMetric({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: null | number | undefined;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-4">
      <div className="text-xl font-semibold text-white">
        {formatCount(value)}
      </div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function BacklogMetric({
  label,
  value,
}: {
  label: string;
  value: null | number | undefined;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-4">
      <div className="text-lg font-semibold text-white">
        {formatCount(value)}
      </div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
    </div>
  );
}

export default function ReviewWorkbenchStats({
  isError,
  isLoading,
  stats,
}: {
  isError: boolean;
  isLoading: boolean;
  stats: ReviewWorkbenchStats | undefined;
}) {
  const today = stats?.snapshot.today;
  const backlog = stats?.snapshot.backlog;

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_340px]">
        <article className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Listing Throughput
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Today&apos;s match flow
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            {isError
              ? "Workbench throughput stats are temporarily unavailable."
              : "Track how many listings cleared automatically, how many required moderator review, and how many are still waiting on a queue outcome."}
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SnapshotMetric
              label="New Listings"
              value={isError ? null : today?.newListings}
              detail="Fresh store listings created today."
            />
            <SnapshotMetric
              label="Matched"
              value={isError ? null : today?.matchedSuccessfully}
              detail="Listings currently approved to a bottle or bottling."
            />
            <SnapshotMetric
              label="Auto Cleared"
              value={isError ? null : today?.autoResolved}
              detail="Approved without ever entering the moderator queue."
            />
            <SnapshotMetric
              label="Auto Ignored"
              value={isError ? null : today?.autoIgnored}
              detail="Dismissed automatically as non-actionable listings."
            />
            <SnapshotMetric
              label="Sent To Queue"
              value={isError ? null : today?.sentToQueue}
              detail="Listings that required moderator review."
            />
            <SnapshotMetric
              label="Queue Approved"
              value={isError ? null : today?.queueApproved}
              detail="Queued listings that have already been approved."
            />
          </div>
        </article>

        <article className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Queue Backlog
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Current aging
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            {isError
              ? "Queue backlog stats are temporarily unavailable."
              : "Watch the live review backlog and how long actionable work has been sitting."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <BacklogMetric
              label="Actionable"
              value={isError ? null : backlog?.actionable}
            />
            <BacklogMetric
              label="Processing"
              value={isError ? null : backlog?.processing}
            />
            <BacklogMetric
              label="Errored"
              value={isError ? null : backlog?.errored}
            />
            <BacklogMetric
              label="Over 24h"
              value={isError ? null : backlog?.olderThan24Hours}
            />
            <BacklogMetric
              label="Over 72h"
              value={isError ? null : backlog?.olderThan72Hours}
            />
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-4">
              <div className="text-lg font-semibold text-white">
                {isError ? "\u2014" : formatHours(backlog?.oldestHours)}
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Oldest Actionable
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-5 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Daily Trend
            </div>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Last {stats?.windowDays ?? 14} days of listing outcomes
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Daily cohorts are based on listing intake date, so you can see how
              each day&apos;s new work is landing across automatic matches,
              moderator review, ignores, and unresolved queue work.
            </p>
          </div>
          <div className="max-w-md text-xs text-slate-500">
            Queue-required counts are exact for new evaluations going forward.
            Older approved listings may still count only as matched because
            prior queue transitions were not persisted.
          </div>
        </div>

        {isLoading && !stats ? (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-6 text-sm text-slate-400">
            Loading workbench stats.
          </div>
        ) : isError || !stats ? (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-6 text-sm text-slate-400">
            Could not load the daily workbench stats.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-800 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5 text-right">New</th>
                  <th className="px-3 py-2.5 text-right">Matched</th>
                  <th className="px-3 py-2.5 text-right">Auto</th>
                  <th className="px-3 py-2.5 text-right">Auto Ignored</th>
                  <th className="px-3 py-2.5 text-right">To Queue</th>
                  <th className="px-3 py-2.5 text-right">Queue Approved</th>
                  <th className="px-3 py-2.5 text-right">Queue Ignored</th>
                  <th className="px-3 py-2.5 text-right">Open</th>
                  <th className="px-3 py-2.5 text-right">Errored</th>
                </tr>
              </thead>
              <tbody>
                {stats.daily.map((day, index) => (
                  <tr
                    key={day.date}
                    className={
                      index === 0
                        ? "border-b border-slate-800 bg-slate-900/40 text-white"
                        : "border-b border-slate-900 text-slate-300"
                    }
                  >
                    <td className="px-3 py-3 font-medium">{day.date}</td>
                    <td className="px-3 py-3 text-right">
                      {formatCount(day.newListings)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCount(day.matchedSuccessfully)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCount(day.autoResolved)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCount(day.autoIgnored)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCount(day.sentToQueue)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCount(day.queueApproved)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCount(day.queueIgnored)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCount(day.queueOpen)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCount(day.queueErrored)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
