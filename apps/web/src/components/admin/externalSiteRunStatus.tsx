import { type ExternalSiteHealthSchema } from "@peated/server/schemas";
import TimeSince from "@peated/web/components/timeSince";
import { type z } from "zod";

import { AdminStatus } from "./adminContent.stylex";

type SiteHealth = z.infer<typeof ExternalSiteHealthSchema>;

export default function ExternalSiteRunStatus({
  site,
  compact = false,
}: {
  site: SiteHealth;
  compact?: boolean;
}) {
  const run = site.latestRun;
  const status = run?.status ?? "never";
  const labels = {
    never: "Never recorded",
    queued: "Queued",
    running: "Running",
    succeeded: "Succeeded",
    failed: "Failed",
  } as const;
  const tones = {
    never: "neutral",
    queued: "accent",
    running: "warning",
    succeeded: "success",
    failed: "danger",
  } as const;
  const timestamp =
    run?.status === "queued"
      ? run.createdAt
      : run?.status === "running"
        ? run.startedAt
        : run?.completedAt;

  return (
    <AdminStatus tone={tones[status]}>
      {labels[status]}
      {timestamp ? (
        <>
          {" "}
          · <TimeSince date={timestamp} />
        </>
      ) : null}
      {!compact && status === "failed" && site.lastSucceededAt ? (
        <>
          {" "}
          · last succeeded <TimeSince date={site.lastSucceededAt} />
        </>
      ) : null}
    </AdminStatus>
  );
}
