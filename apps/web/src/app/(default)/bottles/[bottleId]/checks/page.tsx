"use client";

import {
  BottleCheckSubject,
  getBottleCheckFindings,
  getBottleCheckOperationCount,
  getBottleCheckState,
  getBottleCheckSummary,
} from "@peated/web/components/bottleChecks/checkSummary";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Link from "@peated/web/components/link";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export default function Page() {
  const { bottleId } = useParams<{ bottleId: string }>();
  const bottle = Number(bottleId);
  const orpc = useORPC();
  const historyOptions = orpc.bottleChecks.history.queryOptions({
    input: { bottle },
  });
  const { data } = useSuspenseQuery(historyOptions);

  return (
    <div className="p-3 lg:p-0">
      <h2 className="mb-4 text-lg font-semibold text-white">Audit history</h2>
      {data.results.length > 0 ? (
        <div className="space-y-4">
          {data.results.map((check) => {
            const findings = getBottleCheckFindings(check);
            const operationCount = getBottleCheckOperationCount(check);
            return (
              <article
                className="rounded-xl border border-slate-800 bg-slate-950 p-5"
                key={check.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {getBottleCheckState(check)}
                    </div>
                    <p className="mt-2 text-sm text-slate-200">
                      {getBottleCheckSummary(check)}
                    </p>
                  </div>
                  <Link
                    className="text-highlight text-sm font-semibold hover:underline"
                    href={`/bottle-checks/${check.id}`}
                  >
                    View review
                  </Link>
                </div>
                <div className="mt-4 text-xs text-slate-400">
                  <BottleCheckSubject check={check} /> · {operationCount}{" "}
                  operation{operationCount === 1 ? "" : "s"} · {findings.length}{" "}
                  finding{findings.length === 1 ? "" : "s"}
                </div>
                {check.closedAt ? (
                  <div className="mt-3 text-xs text-slate-400">
                    Closed as{" "}
                    {check.closeReason === "resolved_manually"
                      ? "resolved manually"
                      : "dismissed"}
                    {check.closeNote ? `: ${check.closeNote}` : ""}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyActivity>This Bottle has no audit history.</EmptyActivity>
      )}
    </div>
  );
}
