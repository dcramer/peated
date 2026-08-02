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
    <section className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-200">
          {getBottleCheckState(check)}
        </span>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <p className="mt-2 text-sm text-slate-200">
        {getBottleCheckSummary(check)}
      </p>

      {clean ? (
        <div className="mt-2 text-sm text-emerald-300">
          No catalog changes or unresolved findings were proposed.
        </div>
      ) : null}

      {findings.length > 0 ? (
        <div className="mt-4 border-t border-slate-800 pt-3">
          <h3 className="text-sm font-semibold text-white">Findings</h3>
          <div className="mt-2 space-y-3">
            {findings.map((finding, index) => {
              return (
                <article
                  className="text-sm text-slate-200"
                  key={`${finding.scope}:${finding.summary}:${index}`}
                >
                  <p>{finding.summary}</p>
                  {finding.evidenceRefs.length > 0 ? (
                    <details className="mt-1 text-xs text-slate-400">
                      <summary className="cursor-pointer hover:text-white">
                        Evidence
                      </summary>
                      <EvidenceList evidence={finding.evidenceRefs} />
                    </details>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
