"use client";

import {
  BottleCheckSubject,
  getBottleCheckFindings,
  getBottleCheckState,
  getBottleCheckSummary,
} from "@peated/web/components/bottleChecks/checkSummary";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Link from "@peated/web/components/link";
import SimpleHeader from "@peated/web/components/simpleHeader";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function Page() {
  const { bottleId } = useParams<{ bottleId: string }>();
  const bottle = Number(bottleId);
  const orpc = useORPC();
  const historyOptions = orpc.bottleChecks.history.queryOptions({
    input: { bottle },
  });
  const { data } = useSuspenseQuery(historyOptions);
  const queryClient = useQueryClient();
  const auditMutation = useMutation(orpc.bottleChecks.audit.mutationOptions());
  const [note, setNote] = useState("");

  async function runAudit() {
    await auditMutation.mutateAsync({
      bottle,
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    setNote("");
    await queryClient.invalidateQueries({ queryKey: historyOptions.queryKey });
  }

  return (
    <div className="p-3 lg:p-0">
      <SimpleHeader>Bottle Checks</SimpleHeader>

      <section className="mb-8 rounded-xl border border-slate-800 bg-slate-950 p-5">
        <h2 className="text-lg font-semibold text-white">Audit this Bottle</h2>
        <p className="mt-2 text-sm text-slate-300">
          The audit is read-only. Any proposed catalog changes will require
          separate moderator approval.
        </p>
        <label className="mt-4 block text-sm font-medium text-slate-300">
          Optional context
          <textarea
            className="mt-2 block min-h-24 w-full rounded border-0 bg-slate-800 px-4 py-2 text-white"
            onChange={(event) => setNote(event.target.value)}
            placeholder="What looks wrong?"
            value={note}
          />
        </label>
        <div className="mt-4">
          <Button
            color="primary"
            disabled={auditMutation.isPending}
            loading={auditMutation.isPending}
            onClick={() => void runAudit()}
          >
            {auditMutation.isPending ? "Running Audit" : "Run Bottle Audit"}
          </Button>
        </div>
        {auditMutation.isError ? (
          <p className="mt-3 text-sm text-red-300">
            The audit could not be completed. Try again when the classifier is
            available.
          </p>
        ) : null}
      </section>

      <h2 className="mb-4 text-lg font-semibold text-white">Audit history</h2>
      {data.results.length > 0 ? (
        <div className="space-y-4">
          {data.results.map((check) => {
            const findings = getBottleCheckFindings(check);
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
                  <BottleCheckSubject check={check} /> ·{" "}
                  {check.operations.length} operation
                  {check.operations.length === 1 ? "" : "s"} · {findings.length}{" "}
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
        <EmptyActivity>No audits have been run for this Bottle.</EmptyActivity>
      )}
    </div>
  );
}
