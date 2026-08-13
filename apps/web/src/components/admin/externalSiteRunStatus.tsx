import { type ExternalSiteHealthSchema } from "@peated/server/schemas";
import TimeSince from "@peated/web/components/timeSince";
import classNames from "@peated/web/lib/classNames";
import { type z } from "zod";

type SiteHealth = z.infer<typeof ExternalSiteHealthSchema>;

export default function ExternalSiteRunStatus({
  site,
  compact = false,
}: {
  site: SiteHealth;
  compact?: boolean;
}) {
  const run = site.latestRun;
  const disabled = site.runEvery === null && run === null;
  const status = disabled ? "disabled" : (run?.status ?? "never");
  const labels = {
    disabled: "Disabled",
    never: "Never recorded",
    queued: "Queued",
    running: "Running",
    succeeded: "Succeeded",
    failed: "Failed",
  } as const;
  const colors = {
    disabled: "bg-slate-500",
    never: "bg-slate-500",
    queued: "bg-sky-400",
    running: "bg-amber-400",
    succeeded: "bg-green-400",
    failed: "bg-red-400",
  } as const;
  const timestamp =
    run?.status === "queued"
      ? run.createdAt
      : run?.status === "running"
        ? run.startedAt
        : run?.completedAt;

  return (
    <div className={classNames(compact ? "inline-flex" : "")}>
      <div className="inline-flex items-center gap-2 font-medium">
        <span
          aria-hidden="true"
          className={classNames("h-2 w-2 rounded-full", colors[status])}
        />
        {labels[status]}
        {timestamp && !disabled ? (
          <span className="text-muted font-normal">
            · <TimeSince date={timestamp} />
          </span>
        ) : null}
      </div>
      {!compact && status === "failed" && site.lastSucceededAt ? (
        <div className="text-muted mt-1 text-xs">
          Last succeeded <TimeSince date={site.lastSucceededAt} />
        </div>
      ) : null}
    </div>
  );
}
