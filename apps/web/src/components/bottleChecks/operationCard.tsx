"use client";

import {
  ArrowRightIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import type { Inputs, Outputs } from "@peated/server/orpc/router";
import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Details = Outputs["audits"]["details"];
export type BottleOperation = Details["audit"]["operations"][number];
export type BottleOperationReview = NonNullable<
  Details["reviewOperations"][number]["review"]
>;
export type BottleOperationEvidence =
  BottleOperation["proposal"]["evidenceRefs"][number];
type RejectionReason = Inputs["audits"]["rejectSelected"]["reason"];
export type ExcludedOperationField = NonNullable<
  Inputs["audits"]["approveSelected"]["operations"][number]["excludedFields"]
>[number];

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

const STATUS_LABELS: Record<BottleOperation["status"], string> = {
  blocked: "Blocked",
  pending_review: "Pending review",
  rejected: "Removed",
  applying: "Applying",
  applied: "Applied",
  stale: "Stale",
  failed: "Failed",
};

const OPERATION_LABELS: Record<BottleOperation["proposal"]["type"], string> = {
  update_bottle: "Update Bottle",
  merge_bottles: "Merge Bottles",
  update_entity: "Update Entity",
  merge_entities: "Merge Entities",
};

const BOTTLE_FIELD_LABELS: Record<string, string> = {
  "exact.edition": "Edition",
  "exact.abv": "ABV",
  "exact.releaseYear": "Release year",
};

function formatFieldLabel(field: string): string {
  const name = field.split(".").at(-1) ?? field;
  const words = name.replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatBottleFieldLabel(field: string): string {
  return BOTTLE_FIELD_LABELS[field] ?? formatFieldLabel(field);
}

function formatValue(value: unknown): string {
  if (value === null) return "None";
  if (value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "object") {
    if ("name" in value && typeof value.name === "string") return value.name;
    if ("entity" in value && typeof value.entity === "object") {
      const entity = value.entity as { name?: unknown };
      if (typeof entity.name === "string") return `${entity.name} (new)`;
    }
  }
  return JSON.stringify(value);
}

function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (typeof current !== "object" || current === null) return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function ImpactList({
  hideSingles = false,
  values,
}: {
  hideSingles?: boolean;
  values: Record<string, number | undefined>;
}) {
  const entries = Object.entries(values).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === "number" && entry[1] > (hideSingles ? 1 : 0),
  );
  if (entries.length === 0) return null;

  return (
    <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
      {entries.map(([label, value]) => (
        <div className="flex gap-1" key={label}>
          <dd className="font-semibold text-slate-200">{value}</dd>
          <dt className="lowercase">{label.replaceAll(/([A-Z])/g, " $1")}</dt>
        </div>
      ))}
    </dl>
  );
}

function Warnings({
  warnings,
}: {
  warnings: Array<{ code: string; message: string }>;
}) {
  if (warnings.length === 0) return null;
  return (
    <div className="mt-4 rounded border border-amber-800 bg-amber-950/40 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-amber-300">
        Warnings
      </div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-100">
        {warnings.map((warning) => (
          <li key={`${warning.code}:${warning.message}`}>{warning.message}</li>
        ))}
      </ul>
    </div>
  );
}

function FieldDiff({
  after,
  before,
  editableFields = [],
  excludedFields = new Set(),
  fields,
  labelField = formatFieldLabel,
  onToggleField,
}: {
  after: unknown;
  before: unknown;
  editableFields?: readonly string[];
  excludedFields?: ReadonlySet<string>;
  fields: string[];
  labelField?: (field: string) => string;
  onToggleField?: (field: ExcludedOperationField) => void;
}) {
  function renderToggle(field: string, excluded: boolean) {
    const editable = editableFields.includes(field);
    if (!onToggleField) return null;
    if (!editable) {
      return <span className="text-xs text-slate-500">Linked</span>;
    }
    return (
      <button
        aria-label={`${excluded ? "Include" : "Exclude"} ${labelField(field)}`}
        aria-pressed={!excluded}
        className={`focus-visible:outline-peated min-h-9 rounded border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
          excluded
            ? "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white"
            : "border-emerald-700 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-900/50"
        }`}
        onClick={() => onToggleField(field as ExcludedOperationField)}
        type="button"
      >
        {excluded ? "Skipped" : "Use"}
      </button>
    );
  }

  return (
    <div className="mt-3">
      <div className="space-y-2 sm:hidden">
        {fields.map((field) => {
          const excluded = excludedFields.has(field);
          return (
            <div
              className={`rounded-lg border border-slate-800 bg-slate-950/60 p-3 ${
                excluded ? "opacity-50" : ""
              }`}
              key={field}
            >
              <div className="flex min-h-9 items-center justify-between gap-3">
                <div
                  className={`text-sm font-semibold text-slate-200 ${
                    excluded ? "line-through" : ""
                  }`}
                >
                  {labelField(field)}
                </div>
                {renderToggle(field, excluded)}
              </div>
              <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Current
                  </dt>
                  <dd className="mt-1 break-words text-sm text-slate-400">
                    {formatValue(getPath(before, field))}
                  </dd>
                </div>
                <ArrowRightIcon
                  aria-hidden="true"
                  className="mt-5 h-4 w-4 text-slate-600"
                />
                <div className="min-w-0">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Proposed
                  </dt>
                  <dd className="mt-1 break-words text-sm font-medium text-white">
                    {formatValue(getPath(after, field))}
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
      <table className="hidden min-w-full divide-y divide-slate-800 text-sm sm:table">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
            {onToggleField ? <th className="w-20 py-2 pr-4">Apply</th> : null}
            <th className="py-2 pr-4">Field</th>
            <th className="py-2 pr-4">Current</th>
            <th className="py-2">Proposed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {fields.map((field) => {
            const excluded = excludedFields.has(field);
            return (
              <tr className={excluded ? "opacity-50" : undefined} key={field}>
                {onToggleField ? (
                  <td className="py-2 pr-4">{renderToggle(field, excluded)}</td>
                ) : null}
                <td className="py-2 pr-4 font-medium text-slate-300">
                  <span className={excluded ? "line-through" : undefined}>
                    {labelField(field)}
                  </span>
                </td>
                <td className="py-2 pr-4 text-slate-400">
                  {formatValue(getPath(before, field))}
                </td>
                <td className="py-2 text-white">
                  {formatValue(getPath(after, field))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Preview({
  editableFields,
  excludedFields,
  onToggleField,
  review,
}: {
  editableFields: readonly string[];
  excludedFields: ReadonlySet<string>;
  onToggleField?: (field: ExcludedOperationField) => void;
  review: BottleOperationReview;
}) {
  if (review.status === "blocked") {
    return (
      <div className="mt-4 rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
        {review.preparationError.message}
      </div>
    );
  }

  switch (review.type) {
    case "update_bottle":
      return (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Live Bottle diff
          </div>
          <FieldDiff
            after={review.preview.after}
            before={review.preview.before}
            editableFields={editableFields}
            excludedFields={excludedFields}
            fields={review.preview.changedFields}
            labelField={formatBottleFieldLabel}
            onToggleField={onToggleField}
          />
          <ImpactList
            hideSingles
            values={{
              affectedBottles: review.preview.affectedBottles.total,
              entitiesCreated: review.preview.entityCreations.length,
            }}
          />
          <Warnings warnings={review.preview.warnings} />
        </div>
      );
    case "merge_bottles":
      return (
        <div className="mt-4">
          <div className="text-sm text-slate-300">
            Retire{" "}
            <strong className="text-white">
              {review.preview.source.fullName}
            </strong>{" "}
            into{" "}
            <strong className="text-white">
              {review.preview.destination.fullName}
            </strong>
            .
          </div>
          <ImpactList values={review.preview.consumers} />
          <Warnings warnings={review.preview.warnings} />
        </div>
      );
    case "update_entity":
      return (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Live Entity diff
          </div>
          <FieldDiff
            after={review.preview.after}
            before={review.preview.before}
            editableFields={editableFields}
            excludedFields={excludedFields}
            fields={review.preview.changedFields}
            onToggleField={onToggleField}
          />
          <ImpactList hideSingles values={review.preview.impact} />
          <Warnings warnings={review.preview.warnings} />
        </div>
      );
    case "merge_entities":
      return (
        <div className="mt-4">
          <div className="text-sm text-slate-300">
            Retire{" "}
            <strong className="text-white">{review.preview.source.name}</strong>{" "}
            into{" "}
            <strong className="text-white">
              {review.preview.destination.name}
            </strong>
            . Surviving roles: {review.preview.after.roles.join(", ")}.
          </div>
          <ImpactList values={review.preview.impact} />
          <ImpactList
            values={{
              bottleIdentityCollisions:
                review.preview.collisions.bottleIdentities,
              seriesCollisions: review.preview.collisions.series,
            }}
          />
          <Warnings warnings={review.preview.warnings} />
        </div>
      );
  }
}

function ResourceLinks({ operation }: { operation: BottleOperation }) {
  const proposal = operation.proposal;
  let links: ReactNode[];
  switch (proposal.type) {
    case "update_bottle":
      links = [
        <Link
          className="underline"
          href={`/bottles/${proposal.input.bottleId}/edit`}
          key="bottle"
        >
          Edit Bottle #{proposal.input.bottleId}
        </Link>,
      ];
      break;
    case "merge_bottles":
      links = [
        <Link
          className="underline"
          href={`/bottles/${proposal.input.sourceBottleId}/edit`}
          key="source"
        >
          Edit source Bottle
        </Link>,
        <Link
          className="underline"
          href={`/bottles/${proposal.input.destinationBottleId}/edit`}
          key="destination"
        >
          Edit destination Bottle
        </Link>,
      ];
      break;
    case "update_entity":
      links = [
        <Link
          className="underline"
          href={`/entities/${proposal.input.entityId}/edit`}
          key="entity"
        >
          Edit Entity #{proposal.input.entityId}
        </Link>,
      ];
      break;
    case "merge_entities":
      links = [
        <Link
          className="underline"
          href={`/entities/${proposal.input.sourceEntityId}/edit`}
          key="source"
        >
          Edit source Entity
        </Link>,
        <Link
          className="underline"
          href={`/entities/${proposal.input.destinationEntityId}/edit`}
          key="destination"
        >
          Edit destination Entity
        </Link>,
      ];
      break;
  }
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-300">
      {links}
    </div>
  );
}

function ExecutionSummary({ operation }: { operation: BottleOperation }) {
  if (operation.status !== "applying" && operation.status !== "applied") {
    return null;
  }

  const inProgress = operation.status === "applying";
  const proposal = operation.proposal;
  let message: string;
  switch (proposal.type) {
    case "update_bottle":
      message = inProgress
        ? `Bottle #${proposal.input.bottleId} is being updated.`
        : `Bottle #${proposal.input.bottleId} was updated.`;
      break;
    case "merge_bottles":
      message = inProgress
        ? `Bottle #${proposal.input.sourceBottleId} is being merged into Bottle #${proposal.input.destinationBottleId}.`
        : `Bottle #${proposal.input.sourceBottleId} was merged into Bottle #${proposal.input.destinationBottleId}.`;
      break;
    case "update_entity":
      message = inProgress
        ? `Entity #${proposal.input.entityId} is being updated.`
        : `Entity #${proposal.input.entityId} was updated.`;
      break;
    case "merge_entities":
      message = inProgress
        ? `Entity #${proposal.input.sourceEntityId} is being merged into Entity #${proposal.input.destinationEntityId}.`
        : `Entity #${proposal.input.sourceEntityId} was merged into Entity #${proposal.input.destinationEntityId}.`;
      break;
  }

  const reconciled =
    operation.result &&
    "reconciled" in operation.result &&
    operation.result.reconciled === true;
  return (
    <div className="mt-4 rounded border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200">
      {message}
      {reconciled ? " The prior execution was reconciled safely." : ""}
    </div>
  );
}

export function EvidenceList({
  evidence,
}: {
  evidence: readonly BottleOperationEvidence[];
}) {
  if (evidence.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm text-slate-300">
      {evidence.map((ref) => {
        switch (ref.kind) {
          case "bottle":
            return (
              <li key={`bottle:${ref.bottleId}`}>
                Bottle evidence:{" "}
                <Link className="underline" href={`/bottles/${ref.bottleId}`}>
                  #{ref.bottleId}
                </Link>
              </li>
            );
          case "entity":
            return (
              <li key={`entity:${ref.entityId}`}>
                Entity evidence:{" "}
                <Link className="underline" href={`/entities/${ref.entityId}`}>
                  #{ref.entityId}
                </Link>
              </li>
            );
          case "web_result":
            return (
              <li key={ref.url}>
                Web evidence:{" "}
                <a
                  className="break-all underline"
                  href={ref.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {ref.url}
                </a>
              </li>
            );
          case "source":
            return <li key={`source:${ref.field}`}>Source: {ref.field}</li>;
        }
      })}
    </ul>
  );
}

const REJECTABLE_OPERATION_STATUSES = new Set<BottleOperation["status"]>([
  "blocked",
  "pending_review",
  "stale",
  "failed",
]);

export function isBottleOperationRejectable(operation: BottleOperation) {
  return REJECTABLE_OPERATION_STATUSES.has(operation.status);
}

function getEditableFields(
  operation: BottleOperation,
): ExcludedOperationField[] {
  const proposal = operation.proposal;
  if (proposal.type === "update_entity") {
    return Object.keys(proposal.input.patch) as ExcludedOperationField[];
  }
  if (proposal.type === "update_bottle") {
    return [
      ...Object.keys(proposal.input.patch.shared ?? {}).map(
        (field) => `shared.${field}` as ExcludedOperationField,
      ),
      ...Object.keys(proposal.input.patch.exact ?? {}).map(
        (field) => `exact.${field}` as ExcludedOperationField,
      ),
    ];
  }
  return [];
}

export default function OperationCard({
  approvalReady = false,
  actionError = null,
  copying = false,
  compact = false,
  disabled = false,
  actionPending = false,
  onApply,
  onCopy,
  onReject,
  onRetry,
  operation,
  review,
  showDisposition = true,
}: {
  approvalReady?: boolean;
  actionError?: string | null;
  actionPending?: boolean;
  compact?: boolean;
  copying?: boolean;
  disabled?: boolean;
  onApply?: (
    operationId: number,
    excludedFields: ExcludedOperationField[],
  ) => void;
  onCopy?: (operationId: number) => void;
  onReject?: (
    operationId: number,
    reason: RejectionReason,
    note?: string,
  ) => Promise<void> | void;
  onRetry?: (operationId: number) => void;
  operation: BottleOperation;
  review: BottleOperationReview | null;
  showDisposition?: boolean;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<{
    note?: string;
    reason: RejectionReason;
  } | null>(null);
  const [savingRemoval, setSavingRemoval] = useState(false);
  const removalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rejectionPanel = useRef<HTMLDivElement | null>(null);
  const undoButton = useRef<HTMLButtonElement | null>(null);
  const mounted = useRef(true);
  const [rejectionReason, setRejectionReason] =
    useState<RejectionReason>("wrong_change");
  const [rejectionNote, setRejectionNote] = useState("");
  const editableFields = getEditableFields(operation);
  const [excludedFields, setExcludedFields] = useState<
    Set<ExcludedOperationField>
  >(() => new Set(operation.excludedFields as ExcludedOperationField[]));
  const notApprovalReady =
    showDisposition && operation.status === "pending_review" && !approvalReady;
  const canApply =
    showDisposition && !!onApply && operation.status === "pending_review";
  const canReject =
    showDisposition && !!onReject && isBottleOperationRejectable(operation);
  const canRetry =
    showDisposition && !!onRetry && operation.status === "failed";
  const canConfirmRejection =
    rejectionReason !== "other" || rejectionNote.trim().length > 0;
  const allFieldsExcluded =
    editableFields.length > 0 &&
    editableFields.every((field) => excludedFields.has(field));
  const Heading = compact ? "h2" : "h3";

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (pendingRemoval && !savingRemoval) undoButton.current?.focus();
  }, [pendingRemoval, savingRemoval]);

  useEffect(() => {
    if (!rejecting) return;
    const frame = requestAnimationFrame(() => {
      const panel = rejectionPanel.current;
      if (!panel) return;
      const reservedBottom = window.innerWidth < 1024 ? 112 : 16;
      const overlap =
        panel.getBoundingClientRect().bottom -
        (window.innerHeight - reservedBottom);
      if (overlap <= 0) return;
      window.scrollBy({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        top: overlap + 16,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [rejecting]);

  function toggleField(field: ExcludedOperationField) {
    setExcludedFields((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  function undoRemoval() {
    if (removalTimer.current) clearTimeout(removalTimer.current);
    removalTimer.current = null;
    setPendingRemoval(null);
  }

  function stageRemoval() {
    const removal = {
      reason: rejectionReason,
      ...(rejectionNote.trim() ? { note: rejectionNote.trim() } : {}),
    };
    setRejecting(false);
    setPendingRemoval(removal);
    removalTimer.current = setTimeout(async () => {
      removalTimer.current = null;
      if (mounted.current) setSavingRemoval(true);
      await onReject?.(operation.id, removal.reason, removal.note);
      if (mounted.current) {
        setSavingRemoval(false);
        setPendingRemoval(null);
      }
    }, 4_500);
  }

  if (pendingRemoval) {
    return (
      <article className="rounded-xl border border-amber-800/70 bg-amber-950/20 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Heading className="font-semibold text-white">
              {OPERATION_LABELS[operation.proposal.type]}
            </Heading>
            <p className="mt-1 text-sm text-amber-100" role="status">
              {savingRemoval
                ? "Removing operation…"
                : "Operation removed. This will be saved shortly."}
            </p>
          </div>
          {!savingRemoval ? (
            <Button onClick={undoRemoval} ref={undoButton} size="small">
              Undo remove
            </Button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading className="font-semibold text-white">
            {OPERATION_LABELS[operation.proposal.type]}
          </Heading>
          {!compact ||
          operation.status !== "pending_review" ||
          notApprovalReady ? (
            <span className="mt-2 inline-block rounded-full border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-200">
              {notApprovalReady
                ? "Not ready to approve"
                : STATUS_LABELS[operation.status]}
            </span>
          ) : null}
        </div>
        {onCopy ? (
          <Button
            disabled={copying}
            icon={
              <DocumentDuplicateIcon aria-hidden="true" className="h-5 w-5" />
            }
            loading={copying}
            onClick={() => onCopy(operation.id)}
            size="small"
            title="Copy structured audit operation data as JSON"
          >
            <span className="sr-only">Copy operation payload</span>
          </Button>
        ) : null}
      </div>

      {notApprovalReady ? (
        <p className="mt-3 text-sm text-amber-200" role="status">
          The current catalog state does not support applying this proposal.
        </p>
      ) : null}

      {review ? (
        <Preview
          editableFields={editableFields}
          excludedFields={excludedFields}
          onToggleField={
            operation.status === "pending_review" ? toggleField : undefined
          }
          review={review}
        />
      ) : null}

      {excludedFields.size > 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          {excludedFields.size} proposed field
          {excludedFields.size === 1 ? " is" : "s are"} struck out and will not
          be applied.
        </p>
      ) : null}

      {operation.rejectionReason ? (
        <div className="mt-4 text-sm text-slate-300">
          Removed: {operation.rejectionReason.replaceAll("_", " ")}
          {operation.reviewerNote ? ` — ${operation.reviewerNote}` : ""}
        </div>
      ) : null}
      <ExecutionSummary operation={operation} />
      {operation.error ? (
        <div className="mt-4 rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
          {operation.error}
        </div>
      ) : null}

      {actionError ? (
        <div className="mt-4 rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
          {actionError}
        </div>
      ) : null}

      {canApply || canReject || canRetry ? (
        <div className="-mx-4 mt-4 grid grid-cols-2 gap-2 border-y border-slate-800 bg-slate-900/95 px-4 py-3 sm:mx-0 sm:flex sm:flex-wrap sm:border-b-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-4">
          {canApply ? (
            <Button
              aria-label="Apply included changes"
              className="min-h-10 sm:flex-none"
              color={
                approvalReady && !allFieldsExcluded ? "highlight" : undefined
              }
              disabled={disabled || !approvalReady || allFieldsExcluded}
              loading={actionPending}
              onClick={() => onApply?.(operation.id, [...excludedFields])}
              size="small"
            >
              {actionPending
                ? "Applying…"
                : compact
                  ? "Apply"
                  : "Apply included changes"}
            </Button>
          ) : null}
          {canReject ? (
            <Button
              aria-label="Remove operation"
              className="min-h-10 sm:flex-none"
              disabled={disabled}
              onClick={() => setRejecting((value) => !value)}
              size="small"
            >
              {compact ? "Remove" : "Remove operation"}
            </Button>
          ) : null}
          {canRetry ? (
            <Button
              className="min-h-10 sm:flex-none"
              disabled={disabled}
              loading={actionPending}
              onClick={() => onRetry?.(operation.id)}
              size="small"
            >
              Retry failed operation
            </Button>
          ) : null}
        </div>
      ) : null}

      <details className="mt-4 border-t border-slate-800 pt-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-300 hover:text-white">
          {compact ? "Evidence" : "Evidence and reasoning"}
        </summary>
        <p className="mt-3 text-sm text-slate-300">
          {operation.proposal.rationale}
        </p>
        <EvidenceList evidence={operation.proposal.evidenceRefs} />
        <ResourceLinks operation={operation} />
      </details>

      {rejecting && canReject ? (
        <div
          className="mt-3 scroll-mb-32 rounded border border-slate-800 bg-slate-950 p-3"
          ref={rejectionPanel}
        >
          <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
            <label className="text-xs text-slate-300">
              Reason
              <select
                className="mt-1 block w-full rounded border-0 bg-slate-800 px-3 py-2 text-sm"
                disabled={disabled}
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
            <label className="text-xs text-slate-300">
              Note {rejectionReason === "other" ? "(required)" : "(optional)"}
              <input
                className="mt-1 block w-full rounded border-0 bg-slate-800 px-3 py-2 text-sm"
                disabled={disabled}
                onChange={(event) =>
                  setRejectionNote(event.currentTarget.value)
                }
                value={rejectionNote}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              color="danger"
              disabled={disabled || !canConfirmRejection}
              onClick={stageRemoval}
              size="small"
            >
              Confirm removal
            </Button>
            <Button
              disabled={disabled}
              onClick={() => setRejecting(false)}
              size="small"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
