import type { Outputs } from "@peated/server/orpc/router";
import {
  getBottleCheckFindings,
  getBottleCheckState,
  getBottleCheckSummary,
} from "./checkSummary";
import { EvidenceList } from "./operationCard";

type Check = Outputs["bottleChecks"]["details"]["check"];

export default function CheckResult({
  check,
  title = "Audit result",
}: {
  check: Check;
  title?: string;
}) {
  const findings = getBottleCheckFindings(check);
  const clean = check.operations.length === 0 && findings.length === 0;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950 p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {getBottleCheckState(check)}
      </div>
      <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-slate-200">
        {getBottleCheckSummary(check)}
      </p>

      {clean ? (
        <div className="mt-4 rounded border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-200">
          No catalog changes or unresolved findings were proposed.
        </div>
      ) : null}

      {findings.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-white">Findings</h3>
          <div className="mt-3 space-y-3">
            {findings.map((finding, index) => {
              const scope =
                typeof finding.scope === "string" ? finding.scope : "other";
              const summary =
                typeof finding.summary === "string"
                  ? finding.summary
                  : "Review this finding.";
              const evidence =
                "evidenceRefs" in finding && Array.isArray(finding.evidenceRefs)
                  ? finding.evidenceRefs
                  : [];
              return (
                <article
                  className="rounded border border-slate-800 bg-slate-900/60 p-4"
                  key={`${scope}:${summary}:${index}`}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {scope.replaceAll("_", " ")}
                  </div>
                  <p className="mt-2 text-sm text-slate-200">{summary}</p>
                  <EvidenceList evidence={evidence} />
                </article>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Findings are closed with the check; they do not have individual
            disposition controls.
          </p>
        </div>
      ) : null}
    </section>
  );
}
