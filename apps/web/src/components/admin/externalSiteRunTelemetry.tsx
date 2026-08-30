import type { Outputs } from "@peated/server/orpc/router";
import TimeSince from "@peated/web/components/timeSince";

type Run = Outputs["externalSites"]["runs"]["results"][number];

export default function ExternalSiteRunTelemetry({ run }: { run: Run }) {
  return (
    <span>
      {run.requestCount.toLocaleString("en-US")} /{" "}
      {run.requestLimit.toLocaleString("en-US")} requests ·{" "}
      {run.retryCount.toLocaleString("en-US")} retries ·{" "}
      {run.rateLimitCount.toLocaleString("en-US")} rate limits ·{" "}
      {run.emittedItemCount.toLocaleString("en-US")} items emitted
      {run.nextAttemptAt ? (
        <>
          {" "}
          · continues <TimeSince date={run.nextAttemptAt} />
        </>
      ) : null}
    </span>
  );
}
