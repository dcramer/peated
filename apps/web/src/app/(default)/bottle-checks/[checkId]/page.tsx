"use client";

import type { Inputs, Outputs } from "@peated/server/orpc/router";
import ActionResults, {
  type BottleOperationActionResult,
  runActionWithCanonicalRefresh,
} from "@peated/web/components/bottleChecks/actionResults";
import CheckResult from "@peated/web/components/bottleChecks/checkResult";
import {
  BottleCheckOrigin,
  BottleCheckSubject,
} from "@peated/web/components/bottleChecks/checkSummary";
import OperationCard, {
  isBottleOperationRejectable,
} from "@peated/web/components/bottleChecks/operationCard";
import { getBottleCheckRefetchInterval } from "@peated/web/components/bottleChecks/polling";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import SimpleHeader from "@peated/web/components/simpleHeader";
import useBottleCheckCapabilities from "@peated/web/hooks/useBottleCheckCapabilities";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

type RejectionReason = Inputs["bottleChecks"]["rejectSelected"]["reason"];
type CloseReason = Inputs["bottleChecks"]["close"]["reason"];
type Details = Outputs["bottleChecks"]["details"];

const REJECTION_REASONS: Array<{
  id: RejectionReason;
  label: string;
}> = [
  { id: "wrong_target", label: "Wrong target" },
  { id: "wrong_change", label: "Wrong change" },
  { id: "insufficient_evidence", label: "Insufficient evidence" },
  { id: "resolved_manually", label: "Resolved manually" },
  { id: "other", label: "Other" },
];

const CLOSE_REASONS: Array<{ id: CloseReason; label: string }> = [
  { id: "dismissed", label: "Dismissed" },
  { id: "resolved_manually", label: "Resolved manually" },
];

export default function Page() {
  const { checkId } = useParams<{ checkId: string }>();
  const checkNumber = Number(checkId);
  const orpc = useORPC();
  const { bottleCheckExecution } = useBottleCheckCapabilities();
  const queryClient = useQueryClient();
  const detailsOptions = orpc.bottleChecks.details.queryOptions({
    input: { check: checkNumber },
  });
  const { data } = useSuspenseQuery({
    ...detailsOptions,
    refetchInterval: (query) => getBottleCheckRefetchInterval(query.state.data),
  });
  const check = data.check;
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
    orpc.bottleChecks.approveSelected.mutationOptions(),
  );
  const rejectMutation = useMutation(
    orpc.bottleChecks.rejectSelected.mutationOptions(),
  );
  const retryMutation = useMutation(orpc.bottleChecks.retry.mutationOptions());
  const closeMutation = useMutation(orpc.bottleChecks.close.mutationOptions());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rejectionReason, setRejectionReason] =
    useState<RejectionReason>("wrong_change");
  const [rejectionNote, setRejectionNote] = useState("");
  const [closeReason, setCloseReason] = useState<CloseReason>("dismissed");
  const [closeNote, setCloseNote] = useState("");
  const [actionResults, setActionResults] = useState<
    BottleOperationActionResult[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const busy =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    retryMutation.isPending ||
    closeMutation.isPending;
  const canApprove =
    selected.size > 0 &&
    [...selected].every((operationId) =>
      Boolean(liveReviewByOperation.get(operationId)?.approvalReady),
    );

  async function refresh() {
    setSelected(new Set());
    await queryClient.invalidateQueries({
      queryKey: detailsOptions.queryKey,
    });
    await queryClient.invalidateQueries({
      queryKey: orpc.bottleChecks.list.queryOptions({ input: {} }).queryKey,
    });
    if (check.bottleId) {
      await queryClient.invalidateQueries({
        queryKey: orpc.bottleChecks.history.queryOptions({
          input: { bottle: check.bottleId },
        }).queryKey,
      });
    }
  }

  async function runAction(
    action: () => Promise<BottleOperationActionResult[]>,
  ) {
    setError(null);
    try {
      setActionResults(
        await runActionWithCanonicalRefresh({
          action,
          refresh,
        }),
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The operation could not be completed.",
      );
    }
  }

  function updateSelection(operationId: number, isSelected: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (isSelected) next.add(operationId);
      else next.delete(operationId);
      return next;
    });
  }

  async function approveSelected() {
    const result = await approveMutation.mutateAsync({
      check: check.id,
      operationIds: [...selected],
    });
    return result.results;
  }

  async function rejectSelected() {
    const result = await rejectMutation.mutateAsync({
      check: check.id,
      operationIds: [...selected],
      reason: rejectionReason,
      ...(rejectionNote.trim() ? { note: rejectionNote.trim() } : {}),
    });
    return result.results;
  }

  async function retry(operationId: number) {
    const result = await retryMutation.mutateAsync({
      check: check.id,
      operation: operationId,
    });
    return [result];
  }

  async function closeCheck() {
    setError(null);
    try {
      await closeMutation.mutateAsync({
        check: check.id,
        reason: closeReason,
        ...(closeNote.trim() ? { note: closeNote.trim() } : {}),
      });
      await refresh();
    } catch (closeError) {
      setError(
        closeError instanceof Error
          ? closeError.message
          : "The check could not be closed.",
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
          (Array.isArray(check.output?.findings) &&
            check.output.findings.length > 0)));
  const canReject =
    selected.size > 0 &&
    (rejectionReason !== "other" || rejectionNote.trim().length > 0);
  const isStorePriceReference =
    check.intent === "resolve_reference" && check.sourceKind === "store_price";
  const parentPage = isStorePriceReference
    ? { name: "Incoming Listings", href: "/admin/queue" }
    : { name: "Bottle Checks", href: "/bottle-checks" };

  return (
    <>
      <Breadcrumbs
        pages={[
          parentPage,
          {
            name: `Check #${check.id}`,
            href: `/bottle-checks/${check.id}`,
            current: true,
          },
        ]}
      />
      <SimpleHeader>Bottle Check #{check.id}</SimpleHeader>

      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-slate-300">
        <BottleCheckSubject check={check} />
        {check.bottleId ? (
          <Link
            className="underline"
            href={`/bottles/${check.bottleId}/checks`}
          >
            Bottle audit history
          </Link>
        ) : null}
        <BottleCheckOrigin check={check} />
      </div>

      <div className="space-y-5">
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
                    approvalReady={liveReview?.approvalReady ?? false}
                    checked={selected.has(operation.id)}
                    disabled={busy || !!check.closedAt}
                    executionEnabled={bottleCheckExecution}
                    key={operation.id}
                    onRetry={(operationId) =>
                      void runAction(() => retry(operationId))
                    }
                    onSelect={updateSelection}
                    operation={operation}
                    review={liveReview?.review ?? null}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        {check.schemaSupported &&
        !check.closedAt &&
        !bottleCheckExecution &&
        check.operations.some(({ status }) =>
          ["pending_review", "failed"].includes(status),
        ) ? (
          <p
            className="rounded border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-100"
            role="status"
          >
            Applying catalog changes is disabled during rollout. You can still
            reject operations or close resolved checks.
          </p>
        ) : null}

        {check.schemaSupported &&
        !check.closedAt &&
        check.operations.some(isBottleOperationRejectable) ? (
          <section className="rounded-xl border border-slate-800 bg-slate-950 p-5">
            <h2 className="font-semibold text-white">Selected operations</h2>
            <p className="mt-1 text-xs text-slate-400">
              Approval is independent. One failure does not roll back another
              operation.
            </p>
            {bottleCheckExecution ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  color="primary"
                  disabled={busy || !canApprove}
                  onClick={() => void runAction(approveSelected)}
                >
                  Approve selected
                </Button>
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)_auto]">
              <label className="text-sm text-slate-300">
                Rejection reason
                <select
                  className="mt-2 block w-full rounded border-0 bg-slate-800 px-3 py-2"
                  onChange={(event) =>
                    setRejectionReason(
                      event.currentTarget.value as RejectionReason,
                    )
                  }
                  value={rejectionReason}
                >
                  {REJECTION_REASONS.map((reason) => (
                    <option key={reason.id} value={reason.id}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-300">
                Note {rejectionReason === "other" ? "(required)" : "(optional)"}
                <input
                  className="mt-2 block w-full rounded border-0 bg-slate-800 px-3 py-2"
                  onChange={(event) =>
                    setRejectionNote(event.currentTarget.value)
                  }
                  value={rejectionNote}
                />
              </label>
              <div className="self-end">
                <Button
                  disabled={busy || !canReject}
                  onClick={() => void runAction(rejectSelected)}
                >
                  Reject selected
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        <ActionResults results={actionResults} />

        {canClose ? (
          <section className="rounded-xl border border-slate-800 bg-slate-950 p-5">
            <h2 className="font-semibold text-white">Close check</h2>
            <p className="mt-1 text-xs text-slate-400">
              Close remaining findings or work resolved outside this proposal.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)_auto]">
              <label className="text-sm text-slate-300">
                Close reason
                <select
                  className="mt-2 block w-full rounded border-0 bg-slate-800 px-3 py-2"
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
                  className="mt-2 block w-full rounded border-0 bg-slate-800 px-3 py-2"
                  onChange={(event) => setCloseNote(event.currentTarget.value)}
                  value={closeNote}
                />
              </label>
              <div className="self-end">
                <Button disabled={busy} onClick={() => void closeCheck()}>
                  Close check
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        {check.closedAt ? (
          <section className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-sm text-slate-300">
            Closed as {check.closeReason?.replaceAll("_", " ")}
            {check.closeNote ? ` — ${check.closeNote}` : ""}
          </section>
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
