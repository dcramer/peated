"use client";

import { type ExternalSiteHealthSchema } from "@peated/server/schemas";
import {
  formatTimestamp,
  useViewerTimeZone,
} from "@peated/web/components/timestamp";
import { type z } from "zod";

import { AdminStatus } from "./adminContent.stylex";

type SiteHealth = z.infer<typeof ExternalSiteHealthSchema>;

export default function ExternalSiteRunStatus({ site }: { site: SiteHealth }) {
  const timeZone = useViewerTimeZone();
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
  const timingLabel = {
    never: "No runs have been recorded.",
    queued: "Queued",
    running: "Started",
    succeeded: "Succeeded",
    failed: "Failed",
  } as const;
  const title = timestamp
    ? `${timingLabel[status]} ${formatTimestamp(timestamp, "dateTime", timeZone)}.${
        status === "failed" && site.lastSucceededAt
          ? ` Last succeeded ${formatTimestamp(site.lastSucceededAt, "dateTime", timeZone)}.`
          : ""
      }`
    : timingLabel[status];

  return (
    <AdminStatus title={title} tone={tones[status]}>
      {labels[status]}
    </AdminStatus>
  );
}
