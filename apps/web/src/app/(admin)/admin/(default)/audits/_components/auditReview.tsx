"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import type { Inputs, Outputs } from "@peated/server/orpc/router";
import CheckResult from "@peated/web/components/bottleChecks/checkResult";
import {
  BottleCheckOrigin,
  BottleCheckSubject,
} from "@peated/web/components/bottleChecks/checkSummary";
import { formatBottleCheckOperationLlmExport } from "@peated/web/components/bottleChecks/llmExport";
import type { ExcludedOperationField } from "@peated/web/components/bottleChecks/operationCard";
import OperationCard from "@peated/web/components/bottleChecks/operationCard";
import { getBottleCheckRefetchInterval } from "@peated/web/components/bottleChecks/polling";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import { useFlashMessages } from "@peated/web/components/flash";
import TastingBottleIdentity from "@peated/web/components/tastingBottleIdentity";
import { copyTextToClipboard } from "@peated/web/lib/clipboard";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type RejectionReason = Inputs["audits"]["rejectSelected"]["reason"];
type CloseReason = Inputs["audits"]["close"]["reason"];
type OperationActionResult =
  Outputs["audits"]["approveSelected"]["results"][number];
type AuditSource = NonNullable<NonNullable<Inputs["audits"]["list"]>["source"]>;

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

function AuditedBottle({ bottleId }: { bottleId: number }) {
  const orpc = useORPC();
  const { data: bottle } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({ input: { bottle: bottleId } }),
  );

  return (
    <section aria-label="Audited Bottle">
      <TastingBottleIdentity bottle={bottle} />
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

function isAuditActionable(check: Outputs["audits"]["details"]["audit"]) {
  if (check.closedAt) return false;
  if (!check.schemaSupported) return true;
  return (
    check.output.findings.length > 0 ||
    check.operations.some(({ status }) =>
      ["blocked", "pending_review", "applying", "stale", "failed"].includes(
        status,
      ),
    )
  );
}

export default function AuditReview({
  auditId,
  presentation = "page",
}: {
  auditId: number;
  presentation?: "page" | "panel";
}) {
  const auditNumber = auditId;
  const panel = presentation === "panel";
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("source") as AuditSource | null;
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { flash } = useFlashMessages();
  const detailsOptions = orpc.audits.details.queryOptions({
    input: { audit: auditNumber },
  });
  const navigationOptions = orpc.audits.list.queryOptions({
    input: { limit: 100, ...(source ? { source } : {}) },
  });
  const { data } = useSuspenseQuery({
    ...detailsOptions,
    refetchInterval: (query) => getBottleCheckRefetchInterval(query.state.data),
  });
  const check = data.audit;
  const { data: navigationData } = useSuspenseQuery(navigationOptions);
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
  const [actingOperationId, setActingOperationId] = useState<number | null>(
    null,
  );
  const [advancing, setAdvancing] = useState(false);
  const busy =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    retryMutation.isPending ||
    closeMutation.isPending;

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: detailsOptions.queryKey }),
      queryClient.invalidateQueries({
        queryKey: orpc.audits.list.queryOptions({ input: {} }).queryKey,
      }),
    ]);
    const [updatedDetails, nextPage] = await Promise.all([
      queryClient.fetchQuery(detailsOptions),
      queryClient.fetchQuery(navigationOptions),
    ]);
    return { updatedDetails, nextPage };
  }

  const auditHref = useCallback(
    (id: number) => `/admin/audits/${id}${source ? `?source=${source}` : ""}`,
    [source],
  );

  const advanceToNextAudit = useCallback(
    async (nextPage = navigationData) => {
      if (advancing) return;
      setAdvancing(true);
      setError(null);
      try {
        const next = nextPage.results.find(({ id }) => id !== check.id);
        router.push(
          next
            ? auditHref(next.id)
            : `/admin/audits${source ? `?source=${source}` : ""}`,
        );
      } catch (navigationError) {
        setAdvancing(false);
        setError(
          navigationError instanceof Error
            ? navigationError.message
            : "The next audit could not be opened.",
        );
      }
    },
    [advancing, auditHref, check.id, navigationData, router, source],
  );

  useEffect(() => {
    const next = navigationData.results.find(({ id }) => id !== check.id);
    if (!next) return;
    const href = auditHref(next.id);
    router.prefetch(href);
    void queryClient.prefetchQuery(
      orpc.audits.details.queryOptions({ input: { audit: next.id } }),
    );
  }, [auditHref, check.id, navigationData, orpc, queryClient, router]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (event.key.toLowerCase() === "n" && !busy && !advancing) {
        event.preventDefault();
        void advanceToNextAudit();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advanceToNextAudit, advancing, busy]);

  async function runOperationAction(
    operationId: number,
    action: () => Promise<OperationActionResult>,
  ) {
    setActingOperationId(operationId);
    setError(null);
    setActionErrors((current) => {
      const next = new Map(current);
      next.delete(operationId);
      return next;
    });
    try {
      const result = await action();
      const { nextPage, updatedDetails } = await refresh();
      if (result.error) {
        setActionErrors((current) =>
          new Map(current).set(operationId, result.error as string),
        );
      } else if (!isAuditActionable(updatedDetails.audit)) {
        await advanceToNextAudit(nextPage);
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
    } finally {
      setActingOperationId(null);
    }
  }

  async function applyOperation(
    operationId: number,
    excludedFields: ExcludedOperationField[],
  ) {
    await runOperationAction(operationId, async () => {
      const result = await approveMutation.mutateAsync({
        audit: check.id,
        operations: [{ operationId, excludedFields }],
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
      const { nextPage } = await refresh();
      await advanceToNextAudit(nextPage);
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
  const parentPage = {
    name: "Audits",
    href: `/admin/audits${source ? `?source=${source}` : ""}`,
  };
  const activeOperations = check.schemaSupported
    ? check.operations.filter(
        ({ status }) => status !== "applied" && status !== "rejected",
      )
    : [];
  const reviewedOperations = check.schemaSupported
    ? check.operations.filter(
        ({ status }) => status === "applied" || status === "rejected",
      )
    : [];
  const remainingCount = navigationData.results.length;
  const remainingLabel = `${remainingCount}${navigationData.rel.nextCursor ? "+" : ""} remaining`;

  function renderOperation(operation: (typeof check.operations)[number]) {
    const liveReview = liveReviewByOperation.get(operation.id);
    return (
      <OperationCard
        actionError={actionErrors.get(operation.id) ?? null}
        actionPending={actingOperationId === operation.id}
        approvalReady={liveReview?.approvalReady ?? false}
        copying={copyingOperationId === operation.id}
        compact={panel}
        disabled={busy || !!check.closedAt}
        key={operation.id}
        onApply={(operationId, excludedFields) =>
          void applyOperation(operationId, excludedFields)
        }
        onCopy={(operationId) => void copyOperation(operationId)}
        onReject={(operationId, reason, note) =>
          rejectOperation(operationId, reason, note)
        }
        onRetry={(operationId) => void retryOperation(operationId)}
        operation={operation}
        review={liveReview?.review ?? null}
      />
    );
  }

  return (
    <>
      {!panel ? (
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
      ) : null}

      <div
        className={panel ? "space-y-4 px-3 pb-28 lg:px-0 lg:pb-8" : "space-y-5"}
      >
        <nav
          aria-label="Audit navigation"
          className={
            panel
              ? "sticky top-0 z-20 -mx-3 flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur lg:mx-0 lg:px-0"
              : "sticky top-2 z-20 flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950/95 p-2.5 shadow-lg backdrop-blur sm:gap-3 sm:p-3"
          }
        >
          {!panel ? (
            <Button
              href={parentPage.href}
              icon={<ArrowLeftIcon aria-hidden="true" className="h-4 w-4" />}
              size="small"
            >
              <span className="hidden sm:inline">Back to </span>Audits
            </Button>
          ) : null}
          <div
            className={`flex min-w-0 items-center gap-2 sm:gap-3 ${
              panel ? "w-full justify-between" : ""
            }`}
          >
            <span className="truncate text-xs font-medium text-slate-400">
              {remainingLabel}
            </span>
            <Button
              disabled={busy || advancing}
              icon={<ArrowRightIcon aria-hidden="true" className="h-4 w-4" />}
              loading={advancing}
              onClick={() => void advanceToNextAudit()}
              size="small"
            >
              {advancing ? "Opening…" : "Next"}
            </Button>
          </div>
        </nav>

        {!panel ? (
          <div className="border-b border-slate-800 pb-4">
            <h1 className="text-2xl font-semibold text-white">
              {check.intent === "audit_bottle"
                ? "Bottle audit"
                : "Reference check"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span>Audit #{check.id}</span>
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
          </div>
        ) : check.intent === "resolve_reference" || !check.bottleId ? (
          <h1 className="text-lg font-semibold text-white">
            <BottleCheckSubject check={check} />
          </h1>
        ) : null}

        {check.intent === "audit_bottle" && check.bottleId ? (
          <AuditedBottle bottleId={check.bottleId} />
        ) : null}

        <CheckResult
          check={check}
          compact={panel}
          title={
            check.intent === "resolve_reference"
              ? "Reference result"
              : "Audit result"
          }
        />

        {activeOperations.length > 0 ? (
          <section aria-label="Operations to review">
            {!panel ? (
              <h2 className="mb-3 text-lg font-semibold text-white">
                Operations to review
              </h2>
            ) : null}
            <div className="space-y-4">
              {activeOperations.map(renderOperation)}
            </div>
          </section>
        ) : null}

        {reviewedOperations.length > 0 ? (
          <details className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-300 hover:text-white">
              {panel
                ? `Reviewed (${reviewedOperations.length})`
                : `Reviewed operations (${reviewedOperations.length})`}
            </summary>
            <div className="mt-4 space-y-4">
              {reviewedOperations.map(renderOperation)}
            </div>
          </details>
        ) : null}

        {canClose ? (
          <details
            className="rounded-xl border border-slate-800 bg-slate-950 p-4"
            open={activeOperations.length === 0}
          >
            <summary className="cursor-pointer text-sm font-semibold text-slate-300 hover:text-white">
              {panel
                ? "Close audit"
                : "Finish audit without more catalog changes"}
            </summary>
            {!panel ? (
              <p className="mt-2 text-xs text-slate-400">
                Choose how to disposition the remaining findings, then continue
                to the next audit.
              </p>
            ) : null}
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
                <Button
                  color="highlight"
                  disabled={busy}
                  onClick={() => void closeCheck()}
                >
                  {panel ? "Close & next" : "Close and review next"}
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

        {check.model || check.modelMetadata ? (
          <details className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-300 hover:text-white">
              {panel ? "Classifier details" : "Classifier run details"}
            </summary>
            <div className="mt-4">
              <CheckMetadata check={check} />
            </div>
          </details>
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
