"use client";

import type { Inputs, Outputs } from "@peated/server/orpc/router";
import CheckResult from "@peated/web/components/bottleChecks/checkResult";
import {
  BottleCheckOrigin,
  BottleCheckSubject,
} from "@peated/web/components/bottleChecks/checkSummary";
import OperationCard from "@peated/web/components/bottleChecks/operationCard";
import { getBottleCheckRefetchInterval } from "@peated/web/components/bottleChecks/polling";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import SimpleHeader from "@peated/web/components/simpleHeader";
import useAuth from "@peated/web/hooks/useAuth";
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
type OperationActionResult =
  Outputs["bottleChecks"]["approveSelected"]["results"][number];

const CLOSE_REASONS: Array<{ id: CloseReason; label: string }> = [
  { id: "dismissed", label: "Dismissed" },
  { id: "resolved_manually", label: "Resolved manually" },
];

function requireActionResult(
  results: OperationActionResult[],
): OperationActionResult {
  const result = results[0];
  if (!result) throw new Error("The operation returned no result.");
  return result;
}

export default function Page() {
  const { checkId } = useParams<{ checkId: string }>();
  const checkNumber = Number(checkId);
  const orpc = useORPC();
  const { user } = useAuth();
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
  const [closeReason, setCloseReason] = useState<CloseReason>("dismissed");
  const [closeNote, setCloseNote] = useState("");
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
      queryKey: orpc.bottleChecks.list.queryOptions({ input: {} }).queryKey,
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
        check: check.id,
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
        check: check.id,
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
        check: check.id,
        operation: operationId,
      });
    });
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
          check.output.findings.length > 0));
  const isStorePriceReference =
    check.intent === "resolve_reference" && check.sourceKind === "store_price";
  const parentPage =
    isStorePriceReference && user?.admin
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
                    actionError={actionErrors.get(operation.id) ?? null}
                    approvalReady={liveReview?.approvalReady ?? false}
                    disabled={busy || !!check.closedAt}
                    key={operation.id}
                    onApply={(operationId) => void applyOperation(operationId)}
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
                  Close check
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
