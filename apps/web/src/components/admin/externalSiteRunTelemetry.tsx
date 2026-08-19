import type { Outputs } from "@peated/server/orpc/router";
import TimeSince from "@peated/web/components/timeSince";

type Run = Outputs["externalSites"]["runs"]["results"][number];

export default function ExternalSiteRunTelemetry({ run }: { run: Run }) {
  return (
    <div className="text-muted mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
      <span>
        {run.requestCount.toLocaleString("en-US")} /{" "}
        {run.requestLimit.toLocaleString("en-US")} requests
      </span>
      <span>{run.retryCount.toLocaleString("en-US")} retries</span>
      <span>{run.rateLimitCount.toLocaleString("en-US")} rate limits</span>
      <span>{run.emittedItemCount.toLocaleString("en-US")} items emitted</span>
      {run.nextAttemptAt ? (
        <span>
          Continues <TimeSince date={run.nextAttemptAt} />
        </span>
      ) : null}
    </div>
  );
}
