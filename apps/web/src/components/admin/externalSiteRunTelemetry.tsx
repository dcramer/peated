import type { Outputs } from "@peated/server/orpc/router";
import TimeSince from "@peated/web/components/timeSince";

type Run = Outputs["externalSites"]["runs"]["results"][number];

export default function ExternalSiteRunTelemetry({ run }: { run: Run }) {
  return (
    <span>
      {run.requestCount.toLocaleString("en-US")} /{" "}
      {run.requestLimit.toLocaleString("en-US")} requests ·{" "}
      {run.requestErrorCount === null
        ? "errors not tracked"
        : `${run.requestErrorCount.toLocaleString("en-US")} errors`}{" "}
      · {run.retryCount.toLocaleString("en-US")} retries ·{" "}
      {run.rateLimitCount.toLocaleString("en-US")} slow-downs ·{" "}
      {run.emittedItemCount.toLocaleString("en-US")} records ({" "}
      {run.newItemCount.toLocaleString("en-US")} new ·{" "}
      {run.existingItemCount.toLocaleString("en-US")} seen before
      {run.untrackedItemCount
        ? ` · ${run.untrackedItemCount.toLocaleString("en-US")} not tracked`
        : ""}
      )
      {run.nextAttemptAt ? (
        <>
          {" "}
          · continues <TimeSince date={run.nextAttemptAt} />
        </>
      ) : null}
    </span>
  );
}
