import type { Outputs } from "@peated/server/orpc/router";
import TimeSince from "@peated/web/components/timeSince";
import { formatDuration } from "@peated/web/lib/format";

type Site = Outputs["externalSites"]["healthDetails"];

function Status({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "green" | "amber" | "red" | "slate";
}) {
  const colors = {
    green: "bg-green-400",
    amber: "bg-amber-400",
    red: "bg-red-400",
    slate: "bg-slate-500",
  } as const;
  return (
    <span className="inline-flex items-center gap-2 font-medium">
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${colors[color]}`}
      />
      {children}
    </span>
  );
}

function TargetStatus({
  enabled,
  blockedUntil,
  coolingDown,
}: {
  enabled: boolean;
  blockedUntil: string | null;
  coolingDown: boolean;
}) {
  if (!enabled) return <Status color="red">Disabled</Status>;
  if (blockedUntil && coolingDown) {
    return (
      <Status color="amber">
        Cooling down · <TimeSince date={blockedUntil} />
      </Status>
    );
  }
  return <Status color="green">Enabled</Status>;
}

const robotsLabels = {
  unknown: "Unknown",
  missing: "No robots file",
  rules: "Rules cached",
  not_applicable: "Not applicable",
} as const;

export default function ScraperReadiness({ site }: { site: Site }) {
  const { runtime, reviewPolicy } = site;
  const runtimeSynchronized =
    runtime.targets.length === runtime.targetKeys.length &&
    runtime.targetKeys.every((key) =>
      runtime.targets.some((target) => target.key === key),
    );

  return (
    <section
      aria-labelledby="scraper-readiness-heading"
      className="mb-6 rounded-xl border border-slate-800 bg-slate-950 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="scraper-readiness-heading"
            className="text-lg font-semibold text-white"
          >
            Runtime readiness
          </h2>
          <p className="text-muted mt-1 text-sm">
            Code-owned traffic policy and cached remote state.
          </p>
        </div>
        {!runtime.registered ? (
          <Status color="red">Not registered</Status>
        ) : !runtimeSynchronized ? (
          <Status color="amber">Definitions not synchronized</Status>
        ) : (
          <Status color="green">Registered</Status>
        )}
      </div>

      {runtime.targets.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {runtime.targets.map((target) => (
            <div
              key={target.key}
              className="rounded-lg border border-slate-800 bg-slate-900/50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">{target.key}</div>
                  <div className="text-muted mt-1 text-xs">
                    {formatDuration(target.minimumSpacingMs)} spacing ·{" "}
                    {target.requestsPerWindow.toLocaleString("en-US")} requests
                    / {formatDuration(target.windowMs)}
                  </div>
                </div>
                <TargetStatus
                  enabled={target.enabled}
                  blockedUntil={target.blockedUntil}
                  coolingDown={target.coolingDown}
                />
              </div>
              <div className="mt-3 space-y-2">
                {target.origins.map((origin) => (
                  <div key={origin.origin} className="text-sm">
                    <div className="break-all text-slate-200">
                      {origin.origin}
                    </div>
                    <div className="text-muted mt-1 text-xs">
                      Robots: {robotsLabels[origin.robotsStatus]}
                      {origin.robotsFetchedAt ? (
                        <>
                          {" "}
                          · checked <TimeSince date={origin.robotsFetchedAt} />
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {reviewPolicy ? (
        <div className="mt-4 border-t border-slate-800 pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">Review policy</h3>
              <div className="text-muted mt-1 text-xs capitalize">
                Publication: {reviewPolicy.publicationMode.replace("_", " ")}
                {reviewPolicy.reviewedAt ? (
                  <>
                    {" "}
                    · reviewed <TimeSince date={reviewPolicy.reviewedAt} />
                  </>
                ) : null}
              </div>
            </div>
            <Status color={reviewPolicy.allowFetching ? "green" : "red"}>
              Fetching {reviewPolicy.allowFetching ? "allowed" : "blocked"}
            </Status>
          </div>
          <div className="text-muted mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span>
              LLM processing:{" "}
              {reviewPolicy.allowLlmProcessing ? "allowed" : "blocked"}
            </span>
            <span>
              Scores: {reviewPolicy.allowScoreDisplay ? "visible" : "hidden"}
            </span>
            <span>
              Summaries:{" "}
              {reviewPolicy.allowSummaryDisplay ? "visible" : "hidden"}
            </span>
            {reviewPolicy.policyEvidenceUrl ? (
              <a
                className="text-highlight hover:text-white"
                href={reviewPolicy.policyEvidenceUrl}
                rel="noreferrer"
                target="_blank"
              >
                Policy evidence
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
