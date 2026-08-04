"use client";

import type { Inputs, Outputs } from "@peated/server/orpc/router";
import CheckResult from "@peated/web/components/bottleChecks/checkResult";
import {
  BottleCheckOrigin,
  BottleCheckSubject,
} from "@peated/web/components/bottleChecks/checkSummary";
import { formatBottleCheckOperationLlmExport } from "@peated/web/components/bottleChecks/llmExport";
import OperationCard from "@peated/web/components/bottleChecks/operationCard";
import { getBottleCheckRefetchInterval } from "@peated/web/components/bottleChecks/polling";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import { useFlashMessages } from "@peated/web/components/flash";
import BottleResultRow from "@peated/web/components/search/bottleResult";
import { copyTextToClipboard } from "@peated/web/lib/clipboard";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

type RejectionReason = Inputs["audits"]["rejectSelected"]["reason"];
type CloseReason = Inputs["audits"]["close"]["reason"];
type OperationActionResult =
  Outputs["audits"]["approveSelected"]["results"][number];

const CLOSE_REASONS: Array<{ id: CloseReason; label: string }> = [
  { id: "dismissed", label: "Dismissed" },
  { id: "resolved_manually", label: "Resolved manually" },
];

function formatCost(value: number | undefined): string {
  if (value === undefined) return "Unavailable";
  if (value > 0 && value < 0.0001) return "<$0.0001";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  })}`;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) return `${durationMs.toLocaleString("en-US")} ms`;
  return `${(durationMs / 1_000).toLocaleString("en-US", {
    maximumFractionDigits: 1,
  })} sec`;
}

function AuditedBottleCard({ bottleId }: { bottleId: number }) {
  const orpc = useORPC();
  const { data: bottle } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({ input: { bottle: bottleId } }),
  );

  return (
    <section
      aria-label="Audited Bottle"
      className="relative flex items-center rounded-xl border border-slate-800 bg-slate-950 p-3 sm:p-4"
    >
      <BottleResultRow
        directToTasting={false}
        result={{ type: "bottle", ref: bottle }}
      />
    </section>
  );
}

function CheckMetadata({
  check,
}: {
  check: Outputs["audits"]["details"]["audit"];
}) {
  const metadata = check.modelMetadata;
  const items = [
    ...(check.model ? [{ label: "Model", value: check.model }] : []),
    ...(metadata
      ? [
          {
            label: "Total tokens",
            value: metadata.usage.totalTokens.toLocaleString("en-US"),
          },
          {
            label: "Estimated cost",
            value: formatCost(metadata.cost?.estimatedAgentLoopCostUsd),
          },
          {
            label: "Agent time",
            value: formatDuration(metadata.agentDurationMs),
          },
        ]
      : []),
  ];

  if (items.length === 0) return null;

  return (
    <dl className="grid gap-px overflow-hidden rounded-xl border border-slate-800 bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div className="bg-slate-950 px-4 py-3" key={item.label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {item.label}
          </dt>
          <dd className="mt-1 truncate text-sm font-medium text-slate-200">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function requireActionResult(
  results: OperationActionResult[],
): OperationActionResult {
  const result = results[0];
  if (!result) throw new Error("The operation returned no result.");
  return result;
}

export default function Page() {
  const { auditId } = useParams<{ auditId: string }>();
  const auditNumber = Number(auditId);
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { flash } = useFlashMessages();
  const detailsOptions = orpc.audits.details.queryOptions({
    input: { audit: auditNumber },
  });
  const { data } = useSuspenseQuery({
    ...detailsOptions,
    refetchInterval: (query) => getBottleCheckRefetchInterval(query.state.data),
  });
  const check = data.audit;
  const liveReviewByOperation = useMemo(
    () =>
      new Map(
        data.reviewOperations.map(({ operationId, ...liveReview }) => [
          operationId,
          liveReview,
        ]),
      ),
    [data.reviewOperations],
  );
  const approveMutation = useMutation(
    orpc.audits.approveSelected.mutationOptions(),
  );
  const rejectMutation = useMutation(
    orpc.audits.rejectSelected.mutationOptions(),
  );
  const retryMutation = useMutation(orpc.audits.retry.mutationOptions());
  const closeMutation = useMutation(orpc.audits.close.mutationOptions());
  const [closeReason, setCloseReason] = useState<CloseReason>("dismissed");
  const [closeNote, setCloseNote] = useState("");
  const [copyingOperationId, setCopyingOperationId] = useState<number | null>(
    null,
  );
  const [actionErrors, setActionErrors] = useState<Map<number, string>>(
    new Map(),
  );
  const [error, setError] = useState<string | null>(null);
  const busy =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    retryMutation.isPending ||
    closeMutation.isPending;

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: detailsOptions.queryKey,
    });
    await queryClient.invalidateQueries({
      queryKey: orpc.audits.list.queryOptions({ input: {} }).queryKey,
    });
  }

  async function runOperationAction(
    operationId: number,
    action: () => Promise<OperationActionResult>,
  ) {
    setError(null);
    setActionErrors((current) => {
      const next = new Map(current);
      next.delete(operationId);
      return next;
    });
    try {
      const result = await action();
      await refresh();
      if (result.error) {
        setActionErrors((current) =>
          new Map(current).set(operationId, result.error as string),
        );
      }
    } catch (actionError) {
      setActionErrors((current) =>
        new Map(current).set(
          operationId,
          actionError instanceof Error
            ? actionError.message
            : "The operation could not be completed.",
        ),
      );
    }
  }

  async function applyOperation(operationId: number) {
    await runOperationAction(operationId, async () => {
      const result = await approveMutation.mutateAsync({
        audit: check.id,
        operationIds: [operationId],
      });
      return requireActionResult(result.results);
    });
  }

  async function rejectOperation(
    operationId: number,
    reason: RejectionReason,
    note?: string,
  ) {
    await runOperationAction(operationId, async () => {
      const result = await rejectMutation.mutateAsync({
        audit: check.id,
        operationIds: [operationId],
        reason,
        ...(note ? { note } : {}),
      });
      return requireActionResult(result.results);
    });
  }

  async function retryOperation(operationId: number) {
    await runOperationAction(operationId, async () => {
      return await retryMutation.mutateAsync({
        audit: check.id,
        operation: operationId,
      });
    });
  }

  async function copyOperation(operationId: number) {
    const operation = check.operations.find(({ id }) => id === operationId);
    if (!operation) return;

    setCopyingOperationId(operationId);
    try {
      await copyTextToClipboard(
        formatBottleCheckOperationLlmExport({
          check,
          operation,
          liveReview:
            data.reviewOperations.find(
              ({ operationId: id }) => id === operationId,
            ) ?? null,
        }),
      );
      flash(`Copied audit operation #${operationId} as structured JSON.`);
    } catch {
      flash(`Unable to copy audit operation #${operationId}.`, "error");
    } finally {
      setCopyingOperationId(null);
    }
  }

  async function closeCheck() {
    setError(null);
    try {
      await closeMutation.mutateAsync({
        audit: check.id,
        reason: closeReason,
        ...(closeNote.trim() ? { note: closeNote.trim() } : {}),
      });
      await refresh();
    } catch (closeError) {
      setError(
        closeError instanceof Error
          ? closeError.message
          : "The audit could not be closed.",
      );
    }
  }

  const canClose =
    !check.closedAt &&
    (!check.schemaSupported
      ? check.canClose
      : !check.operations.some(({ status }) =>
          ["pending_review", "applying"].includes(status),
        ) &&
        (check.operations.some(({ status }) =>
          ["blocked", "stale", "failed"].includes(status),
        ) ||
          check.output.findings.length > 0));
  const isStorePriceReference =
    check.intent === "resolve_reference" && check.sourceKind === "store_price";
  const parentPage = isStorePriceReference
    ? { name: "Incoming Listings", href: "/admin/queue" }
    : { name: "Audits", href: "/admin/audits" };

  return (
    <>
      <Breadcrumbs
        pages={[
          parentPage,
          {
            name: `Audit #${check.id}`,
            href: `/admin/audits/${check.id}`,
            current: true,
          },
        ]}
      />

      <div className="space-y-5">
        {check.intent === "audit_bottle" && check.bottleId ? (
          <AuditedBottleCard bottleId={check.bottleId} />
        ) : null}

        <header className="border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-semibold text-white">
            {check.intent === "audit_bottle"
              ? "Bottle audit"
              : "Reference check"}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <span>Check #{check.id}</span>
            <span aria-hidden="true">&middot;</span>
            {check.intent === "audit_bottle" ? (
              <BottleCheckOrigin check={check} />
            ) : (
              <BottleCheckSubject check={check} />
            )}
            {check.intent === "audit_bottle" && !check.bottleId ? (
              <>
                <span aria-hidden="true">&middot;</span>
                <BottleCheckSubject check={check} />
              </>
            ) : null}
          </div>
        </header>

        <CheckMetadata check={check} />

        <CheckResult
          check={check}
          title={
            check.intent === "resolve_reference"
              ? "Reference result"
              : "Audit result"
          }
        />

        {check.schemaSupported && check.operations.length > 0 ? (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              Proposed operations
            </h2>
            <div className="space-y-4">
              {check.operations.map((operation) => {
                const liveReview = liveReviewByOperation.get(operation.id);
                return (
                  <OperationCard
                    actionError={actionErrors.get(operation.id) ?? null}
                    approvalReady={liveReview?.approvalReady ?? false}
                    copying={copyingOperationId === operation.id}
                    disabled={busy || !!check.closedAt}
                    key={operation.id}
                    onApply={(operationId) => void applyOperation(operationId)}
                    onCopy={(operationId) => void copyOperation(operationId)}
                    onReject={(operationId, reason, note) =>
                      void rejectOperation(operationId, reason, note)
                    }
                    onRetry={(operationId) => void retryOperation(operationId)}
                    operation={operation}
                    review={liveReview?.review ?? null}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        {canClose ? (
          <details className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-300 hover:text-white">
              Close without further catalog changes
            </summary>
            <p className="mt-2 text-xs text-slate-400">
              Use this for findings or work resolved outside this proposal.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)_auto]">
              <label className="text-sm text-slate-300">
                Reason
                <select
                  className="mt-1 block w-full rounded border-0 bg-slate-800 px-3 py-2"
                  onChange={(event) =>
                    setCloseReason(event.currentTarget.value as CloseReason)
                  }
                  value={closeReason}
                >
                  {CLOSE_REASONS.map((reason) => (
                    <option key={reason.id} value={reason.id}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Note (optional)
                <input
                  className="mt-1 block w-full rounded border-0 bg-slate-800 px-3 py-2"
                  onChange={(event) => setCloseNote(event.currentTarget.value)}
                  value={closeNote}
                />
              </label>
              <div className="self-end">
                <Button disabled={busy} onClick={() => void closeCheck()}>
                  Close audit
                </Button>
              </div>
            </div>
          </details>
        ) : null}

        {check.closedAt ? (
          <p className="text-sm text-slate-400">
            Closed as {check.closeReason?.replaceAll("_", " ")}
            {check.closeNote ? ` — ${check.closeNote}` : ""}
          </p>
        ) : null}

        {error ? (
          <div className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
      </div>
    </>
  );
}
