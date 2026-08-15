"use client";

import { BottleCreateInputSchema } from "@peated/server/lib/bottleSchemas";
import type { Inputs, Outputs } from "@peated/server/orpc/router";
import type { Bottle } from "@peated/server/types";
import CheckResult from "@peated/web/components/bottleChecks/checkResult";
import type { ExcludedOperationField } from "@peated/web/components/bottleChecks/operationCard";
import OperationCard from "@peated/web/components/bottleChecks/operationCard";
import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import BottleSelector from "./bottleSelector";

type Task = Outputs["admin"]["moderation"]["listTasks"]["results"][number];
type QueueItem = Outputs["prices"]["matchQueue"]["details"];
type RejectionReason = Inputs["audits"]["rejectSelected"]["reason"];
type CloseReason = Inputs["audits"]["close"]["reason"];

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The decision could not be saved.";
}

function formatField(value: unknown): string {
  if (value === null || value === undefined || value === "")
    return "Not provided";
  if (Array.isArray(value)) return value.map(formatField).join(", ");
  if (typeof value === "object") {
    if ("name" in value && typeof value.name === "string") return value.name;
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") {
    return value.toString();
  }
  return JSON.stringify(value);
}

function TaskHeader({ task }: { task: Task }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [task.key]);

  return (
    <header className="border-b border-slate-800 pb-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>{task.category}</span>
        <span aria-hidden="true">/</span>
        <span
          className={
            task.state === "blocked" ? "text-amber-300" : "text-slate-400"
          }
        >
          {task.statusLabel}
        </span>
      </div>
      <h1
        className="mt-3 text-2xl font-semibold text-white"
        ref={headingRef}
        tabIndex={-1}
      >
        {task.question}
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        {task.title} · {task.sourceLabel}
      </p>
    </header>
  );
}

function ListingTask({
  task,
  onComplete,
}: {
  task: Task & { source: { kind: "listing"; proposalId: number } };
  onComplete: (message: string) => Promise<void>;
}) {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { data: item } = useSuspenseQuery(
    orpc.prices.matchQueue.details.queryOptions({
      input: { proposal: task.source.proposalId },
    }),
  );
  const resolve = useMutation(orpc.prices.matchQueue.resolve.mutationOptions());
  const createBottle = useMutation(
    orpc.prices.matchQueue.createBottle.mutationOptions(),
  );
  const repair = useMutation(
    orpc.prices.matchQueue.applyBottleRepair.mutationOptions(),
  );
  const retry = useMutation(orpc.prices.matchQueue.retry.mutationOptions());
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy =
    resolve.isPending ||
    createBottle.isPending ||
    repair.isPending ||
    retry.isPending;

  async function finish(action: () => Promise<unknown>, message: string) {
    setError(null);
    try {
      await action();
      await queryClient.invalidateQueries({
        queryKey: orpc.prices.matchQueue.key(),
      });
      await onComplete(message);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function selectBottle(bottle: Bottle) {
    await finish(
      () =>
        resolve.mutateAsync({
          proposal: item.id,
          action: "match",
          bottle: bottle.id,
        }),
      `Assigned ${item.price.name} to ${bottle.fullName}.`,
    );
    setSelecting(false);
  }

  const primary = (() => {
    if (item.status === "errored") {
      return (
        <Button
          className="min-h-11"
          color="highlight"
          disabled={busy}
          loading={retry.isPending}
          onClick={() =>
            void finish(
              () => retry.mutateAsync({ proposal: item.id }),
              "Listing requeued for classification.",
            )
          }
        >
          Retry classification
        </Button>
      );
    }
    if (item.proposalType === "match_existing" && item.suggestedBottle) {
      return (
        <Button
          className="min-h-11"
          color="highlight"
          disabled={busy}
          loading={resolve.isPending}
          onClick={() =>
            void finish(
              () =>
                resolve.mutateAsync({
                  proposal: item.id,
                  action: "match",
                  bottle: item.suggestedBottle!.id,
                }),
              "Bottle match approved.",
            )
          }
        >
          Approve match
        </Button>
      );
    }
    if (item.proposalType === "create_new" && item.proposedBottle) {
      return (
        <Button
          className="min-h-11"
          color="highlight"
          disabled={busy}
          loading={createBottle.isPending}
          onClick={() =>
            void finish(
              () =>
                createBottle.mutateAsync({
                  proposal: item.id,
                  independentBottle: BottleCreateInputSchema.parse(
                    item.proposedBottle,
                  ),
                }),
              "Bottle created and listing assigned.",
            )
          }
        >
          Create Bottle
        </Button>
      );
    }
    if (item.proposalType === "correction" && item.proposedBottle) {
      return (
        <Button
          className="min-h-11"
          color="highlight"
          disabled={busy}
          loading={repair.isPending}
          onClick={() =>
            void finish(
              () => repair.mutateAsync({ proposal: item.id }),
              "Bottle correction applied.",
            )
          }
        >
          Apply correction
        </Button>
      );
    }
    return null;
  })();

  return (
    <div className="space-y-5">
      <TaskHeader task={task} />
      <section
        aria-labelledby="listing-source"
        className="rounded-xl border border-slate-800 bg-slate-950 p-4 sm:p-5"
      >
        <h2
          className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          id="listing-source"
        >
          Source listing
        </h2>
        <div className="mt-3 flex gap-4">
          {item.price.imageUrl ? (
            <img
              alt=""
              className="h-24 w-20 rounded-lg bg-slate-900 object-contain"
              src={item.price.imageUrl}
            />
          ) : null}
          <div className="min-w-0">
            <p className="font-semibold text-white">{item.price.name}</p>
            <p className="mt-1 text-sm text-slate-400">
              {item.price.site.name} ·{" "}
              {(item.price.price / 100).toLocaleString(undefined, {
                style: "currency",
                currency: item.price.currency.toUpperCase(),
              })}
            </p>
            <a
              className="text-highlight mt-2 inline-block text-sm underline"
              href={item.price.url}
              rel="noreferrer"
              target="_blank"
            >
              Open source listing
            </a>
          </div>
        </div>
      </section>

      {item.suggestedBottle ? (
        <section className="rounded-xl border border-emerald-900/70 bg-emerald-950/20 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Recommended Bottle
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            {item.suggestedBottle.fullName}
          </h2>
          <Link
            className="text-highlight mt-2 inline-block text-sm underline"
            href={`/bottles/${item.suggestedBottle.id}`}
          >
            View Bottle #{item.suggestedBottle.id}
          </Link>
        </section>
      ) : null}

      {item.proposedBottle ? (
        <section className="rounded-xl border border-slate-800 bg-slate-950 p-4 sm:p-5">
          <h2 className="font-semibold text-white">Proposed Bottle</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.entries(item.proposedBottle).map(([field, value]) => (
              <div className="border-b border-slate-800 pb-2" key={field}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {field.replaceAll("_", " ")}
                </dt>
                <dd className="mt-1 text-sm text-slate-200">
                  {formatField(value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {item.error ? (
        <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-100">
          <strong>Classification needs attention.</strong>
          <p className="mt-1">{item.error}</p>
        </div>
      ) : null}
      {item.proposalType === "no_match" && item.status !== "errored" ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-200">
          <strong>No clear Bottle outcome was found.</strong>
          <p className="mt-1 text-slate-400">
            Choose a Bottle if you recognize the listing. Otherwise, ignore it
            to remove it from moderation without assigning a Bottle.
          </p>
        </div>
      ) : null}
      {item.rationale ? (
        <p className="text-sm leading-6 text-slate-300">{item.rationale}</p>
      ) : null}
      {error ? (
        <div
          className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {primary ? (
        <div className="fixed inset-x-3 bottom-16 z-30 rounded-lg border border-slate-700 bg-slate-950/95 p-2 shadow-2xl backdrop-blur sm:hidden [&>*]:w-full">
          {primary}
        </div>
      ) : null}
      <div className="flex flex-col gap-2 border-t border-slate-800 pt-5 sm:flex-row sm:flex-wrap">
        {primary ? <div className="hidden sm:contents">{primary}</div> : null}
        <Button
          className="min-h-11"
          disabled={busy}
          onClick={() => setSelecting(true)}
        >
          {item.suggestedBottle ? "Choose another Bottle" : "Choose Bottle"}
        </Button>
        {item.proposalType === "create_new" && item.proposedBottle ? (
          <Button
            className="min-h-11"
            href={`/bottles/new?name=${encodeURIComponent(item.proposedBottle.name)}`}
          >
            Edit before creation
          </Button>
        ) : null}
        <Button
          className="min-h-11"
          disabled={busy}
          onClick={() =>
            void finish(
              () =>
                resolve.mutateAsync({ proposal: item.id, action: "ignore" }),
              "Listing ignored.",
            )
          }
        >
          {item.proposalType === "no_match"
            ? "Ignore as inconclusive"
            : "Ignore listing"}
        </Button>
      </div>

      <details className="rounded-xl border border-slate-800 bg-slate-950 p-4">
        <summary className="cursor-pointer font-semibold text-slate-200">
          Evidence
        </summary>
        <div className="mt-3 space-y-2 text-sm text-slate-400">
          {item.searchEvidence.length ? (
            item.searchEvidence.map((evidence, index) => (
              <pre className="overflow-x-auto whitespace-pre-wrap" key={index}>
                {JSON.stringify(evidence, null, 2)}
              </pre>
            ))
          ) : (
            <p>No supporting web evidence was saved.</p>
          )}
        </div>
      </details>
      <details className="rounded-xl border border-slate-800 bg-slate-950 p-4">
        <summary className="cursor-pointer font-semibold text-slate-200">
          System details
        </summary>
        <dl className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
          <div>
            <dt>Proposal</dt>
            <dd>#{item.id}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>{item.model ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt>Automation score</dt>
            <dd>{item.automationScore ?? "Unavailable"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{item.status}</dd>
          </div>
        </dl>
      </details>

      <BottleSelector
        name={item.price.name}
        onClose={() => setSelecting(false)}
        onSelect={selectBottle}
        open={selecting}
        source={item.price.url}
      />
    </div>
  );
}

function AuditTask({
  task,
  onComplete,
}: {
  task: Task;
  onComplete: (message: string) => Promise<void>;
}) {
  const source = task.source;
  const checkId = source.kind === "listing" ? 0 : source.checkId;
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(
    orpc.audits.details.queryOptions({ input: { audit: checkId } }),
  );
  const approve = useMutation(orpc.audits.approveSelected.mutationOptions());
  const reject = useMutation(orpc.audits.rejectSelected.mutationOptions());
  const close = useMutation(orpc.audits.close.mutationOptions());
  const [error, setError] = useState<string | null>(null);
  const [closeReason, setCloseReason] = useState<CloseReason>("dismissed");
  const [closeNote, setCloseNote] = useState("");
  const busy = approve.isPending || reject.isPending || close.isPending;

  async function refreshAndComplete(message: string) {
    await queryClient.invalidateQueries({ queryKey: orpc.audits.key() });
    await onComplete(message);
  }

  async function apply(
    operationId: number,
    excludedFields: ExcludedOperationField[],
  ) {
    setError(null);
    try {
      const result = await approve.mutateAsync({
        audit: data.audit.id,
        operations: [{ operationId, excludedFields }],
      });
      const action = result.results[0];
      if (!action || action.error)
        throw new Error(action?.error ?? "The operation returned no result.");
      await refreshAndComplete("Catalog change approved.");
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function remove(
    operationId: number,
    reason: RejectionReason,
    note?: string,
  ) {
    setError(null);
    try {
      const result = await reject.mutateAsync({
        audit: data.audit.id,
        operationIds: [operationId],
        reason,
        ...(note ? { note } : {}),
      });
      const action = result.results[0];
      if (!action || action.error)
        throw new Error(action?.error ?? "The operation returned no result.");
      await refreshAndComplete("Suggested change removed.");
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function closeFindings() {
    setError(null);
    try {
      await close.mutateAsync({
        audit: data.audit.id,
        reason: closeReason,
        ...(closeNote.trim() ? { note: closeNote.trim() } : {}),
      });
      await refreshAndComplete("Findings disposition recorded.");
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  if (source.kind === "listing") return <UnavailableTask />;

  if (source.kind === "operation") {
    const operation = data.audit.operations.find(
      ({ id }) => id === source.operationId,
    );
    const live = data.reviewOperations.find(
      ({ operationId }) => operationId === source.operationId,
    );
    if (!operation) return <UnavailableTask />;
    return (
      <div className="space-y-5">
        <TaskHeader task={task} />
        {error ? (
          <div
            className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        <OperationCard
          actionError={error}
          actionPending={busy}
          approvalReady={live?.approvalReady ?? false}
          compact
          disabled={busy}
          onApply={(id, fields) => void apply(id, fields)}
          onReject={remove}
          operation={operation}
          review={live?.review ?? null}
        />
        <details className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <summary className="cursor-pointer font-semibold text-slate-200">
            System details
          </summary>
          <p className="mt-3 text-sm text-slate-400">
            Audit #{data.audit.id} · Operation #{operation.id} · Schema{" "}
            {data.audit.schemaVersion}
          </p>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TaskHeader task={task} />
      <CheckResult check={data.audit} compact title="Unresolved findings" />
      {data.audit.bottleId ? (
        <Button
          className="min-h-11"
          href={`/bottles/${data.audit.bottleId}/edit`}
        >
          Edit Bottle manually
        </Button>
      ) : null}
      <section className="rounded-xl border border-slate-800 bg-slate-950 p-4 sm:p-5">
        <h2 className="font-semibold text-white">Record disposition</h2>
        <div className="mt-4 grid gap-3">
          <label className="text-sm text-slate-300">
            Reason
            <select
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-white"
              onChange={(event) =>
                setCloseReason(event.currentTarget.value as CloseReason)
              }
              value={closeReason}
            >
              <option value="dismissed">Dismissed</option>
              <option value="resolved_manually">Resolved manually</option>
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Optional note
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-white"
              onChange={(event) => setCloseNote(event.currentTarget.value)}
              value={closeNote}
            />
          </label>
          {error ? (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            className="min-h-11 sm:justify-self-start"
            color="highlight"
            disabled={busy}
            loading={close.isPending}
            onClick={() => void closeFindings()}
          >
            Close findings
          </Button>
        </div>
      </section>
    </div>
  );
}

export function UnavailableTask() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-lg font-semibold text-white">
        This task no longer needs attention
      </p>
      <p className="mt-2 text-sm text-slate-400">
        It may have been completed in another session. The Inbox has been
        refreshed.
      </p>
      <Button className="mt-5 min-h-11" href="/admin/moderation/inbox">
        Return to Inbox
      </Button>
    </div>
  );
}

export default function TaskDetail({
  taskKey,
  onComplete,
}: {
  taskKey: string;
  onComplete: (message: string) => Promise<void>;
}) {
  const orpc = useORPC();
  const locator = useQuery(
    orpc.admin.moderation.task.queryOptions({ input: { key: taskKey } }),
  );
  if (locator.isPending)
    return (
      <div className="animate-pulse p-8 text-sm text-slate-400">
        Loading decision…
      </div>
    );
  if (locator.isError || !locator.data) return <UnavailableTask />;
  const task = locator.data.task;
  if (task.source.kind === "listing")
    return (
      <ListingTask
        onComplete={onComplete}
        task={
          task as Task & { source: { kind: "listing"; proposalId: number } }
        }
      />
    );
  return <AuditTask onComplete={onComplete} task={task} />;
}
