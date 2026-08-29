import type { Outputs } from "@peated/server/orpc/router";
import Button from "@peated/web/components/button";

type Source = Outputs["externalSites"]["scrapeSources"]["list"][number];

export function SetupSteps({ source }: { source: Source }) {
  const latest = source.revisions[0];
  const setupNeedsWork =
    source.setup?.status === "queued" ||
    source.setup?.status === "running" ||
    source.setup?.status === "failed";
  const steps = [
    {
      name: "AI setup",
      status:
        source.setup?.status === "running"
          ? "Running"
          : source.setup?.status === "failed"
            ? "Needs attention"
            : source.setup?.status === "queued"
              ? "Queued"
              : latest
                ? "Complete"
                : "Not started",
      complete: Boolean(latest) && !setupNeedsWork,
    },
    {
      name: "Preview",
      status: !latest
        ? "Waiting"
        : latest.previewStatus === "passed"
          ? "Passed"
          : latest.previewStatus === "failed"
            ? "Needs repair"
            : "Ready",
      complete: latest?.previewStatus === "passed",
    },
    {
      name: "Activate",
      status: source.activeRevisionId ? "Active" : "Waiting",
      complete: Boolean(source.activeRevisionId),
    },
  ];

  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => (
        <li
          key={step.name}
          className="flex gap-3 rounded border border-slate-800 bg-slate-950 p-3"
        >
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              step.complete
                ? "bg-green-900 text-green-200"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            {step.complete ? "✓" : index + 1}
          </span>
          <div>
            <div className="font-medium text-white">{step.name}</div>
            <div className="text-muted text-sm">{step.status}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function SetupNotice({
  source,
  busy,
  canRetry,
  retry,
}: {
  source: Source;
  busy: boolean;
  canRetry: boolean;
  retry: () => void;
}) {
  const setup = source.setup;
  const hasRevision = source.revisions.length > 0;
  if (hasRevision && (!setup || setup.status === "succeeded")) {
    return null;
  }

  const title =
    setup?.status === "running"
      ? hasRevision
        ? "AI is updating the site setup"
        : "AI is setting up this site"
      : setup?.status === "failed"
        ? "AI could not finish setup"
        : setup?.status === "succeeded"
          ? "AI setup finished"
          : setup?.status === "queued"
            ? "AI setup is queued"
            : "AI setup has not started";
  const description =
    setup?.status === "running"
      ? `Peated is finding the pages and ${
          source.kind === "review" ? "review details" : "product information"
        }. It will test and correct the rules before creating a version.`
      : setup?.status === "queued"
        ? "Setup will start shortly. This page refreshes automatically."
        : setup?.status === "succeeded"
          ? "The new version is loading."
          : setup?.status === "failed"
            ? "Review the reason below, then retry if the site is available."
            : "Start AI setup to create the first version.";

  return (
    <section
      className={`rounded border p-4 ${
        setup?.status === "failed"
          ? "border-red-900 bg-red-950/30"
          : "border-slate-800 bg-slate-950"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="text-muted mt-1 text-sm">{description}</p>
        </div>
        {(setup?.status === "failed" || !setup) && canRetry && (
          <Button
            color="highlight"
            disabled={busy}
            loading={busy}
            onClick={retry}
          >
            {setup
              ? hasRevision
                ? "Retry AI repair"
                : "Retry AI setup"
              : "Start AI setup"}
          </Button>
        )}
      </div>
      {setup?.error && (
        <div className="mt-3 rounded bg-red-950/60 px-3 py-2 text-sm text-red-200">
          {setup.error}
        </div>
      )}
    </section>
  );
}
