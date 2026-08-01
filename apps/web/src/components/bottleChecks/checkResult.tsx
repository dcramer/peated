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
  if (!check.schemaSupported) {
    return (
      <section className="rounded-xl border border-amber-800 bg-amber-950/40 p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-amber-200">
          Unsupported schema
        </div>
        <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm text-amber-100">
          This check uses schema version {check.schemaVersion}. Its historical
          proposals cannot be reviewed safely
          {check.canClose
            ? ", but the check can be closed."
            : ". It cannot be closed while an operation is applying."}
        </p>
      </section>
    );
  }

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
              return (
                <article
                  className="rounded border border-slate-800 bg-slate-900/60 p-4"
                  key={`${finding.scope}:${finding.summary}:${index}`}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {finding.scope.replaceAll("_", " ")}
                  </div>
                  <p className="mt-2 text-sm text-slate-200">
                    {finding.summary}
                  </p>
                  <EvidenceList evidence={finding.evidenceRefs} />
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
