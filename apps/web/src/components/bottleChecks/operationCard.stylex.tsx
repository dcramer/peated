"use client";

import type { Inputs, Outputs } from "@peated/server/orpc/router";
import { BottleOperationFieldPathSchema } from "@peated/server/schemas/bottleOperationFields";
import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import Link from "@peated/web/components/admin/adminLink.stylex";
import * as stylex from "@stylexjs/stylex";
import { ArrowRight, Copy } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../styles/tokens.stylex";

type Details = Outputs["audits"]["details"];
export type BottleOperation = Details["audit"]["operations"][number];
export type BottleOperationReview = NonNullable<
  Details["reviewOperations"][number]["review"]
>;
export type BottleOperationEvidence =
  BottleOperation["proposal"]["evidenceRefs"][number];
type RejectionReason = Inputs["audits"]["rejectSelected"]["reason"];
interface PendingRemoval {
  note?: string;
  reason: RejectionReason;
}
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

const STATUS_LABELS = {
  blocked: "Blocked",
  pending_review: "Pending review",
  rejected: "Removed",
  applying: "Applying",
  applied: "Applied",
  stale: "Stale",
  failed: "Failed",
} satisfies Record<BottleOperation["status"], string>;

const OPERATION_LABELS = {
  update_bottle: "Update Bottle",
  merge_bottles: "Merge Bottles",
  update_entity: "Update Entity",
  merge_entities: "Merge Entities",
} satisfies Record<BottleOperation["proposal"]["type"], string>;

interface BottleFieldLabels {
  [field: string]: string | undefined;
}

const BOTTLE_FIELD_LABELS: BottleFieldLabels = {
  "exact.edition": "Edition",
  "exact.abv": "ABV",
  "exact.bottlingYear": "Bottling year",
  "exact.releaseYear": "Release year",
  "exact.releaseMonth": "Release month",
  "exact.releaseDay": "Release day",
};

const DisplayValueSchema = z.json();
type DisplayValue = z.infer<typeof DisplayValueSchema>;

function formatFieldLabel(field: string): string {
  const name = field.split(".").at(-1) ?? field;
  const words = name.replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatBottleFieldLabel(field: string): string {
  return BOTTLE_FIELD_LABELS[field] ?? formatFieldLabel(field);
}

function formatValue(value: DisplayValue | undefined): string {
  if (value === null) return "None";
  if (value === undefined) return "—";
  const booleanValue = z.boolean().safeParse(value);
  if (booleanValue.success) return booleanValue.data ? "Yes" : "No";
  const scalarValue = z.union([z.number(), z.string()]).safeParse(value);
  if (scalarValue.success) return String(scalarValue.data);
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  const namedValue = z.object({ name: z.string() }).safeParse(value);
  if (namedValue.success) return namedValue.data.name;
  const newEntity = z
    .object({ entity: z.object({ name: z.string() }) })
    .safeParse(value);
  if (newEntity.success) return `${newEntity.data.entity.name} (new)`;
  return JSON.stringify(value);
}

function getPath<T>(value: T, path: string): DisplayValue | undefined {
  const parsed = DisplayValueSchema.safeParse(value);
  if (!parsed.success) return undefined;

  return path
    .split(".")
    .reduce<DisplayValue | undefined>((current, segment) => {
      const objectValue = z
        .record(z.string(), DisplayValueSchema)
        .safeParse(current);
      return objectValue.success ? objectValue.data[segment] : undefined;
    }, parsed.data);
}

function ImpactList({
  hideSingles = false,
  values,
}: {
  hideSingles?: boolean;
  values: Record<string, number | undefined>;
}) {
  const entries = Object.entries(values).flatMap(([label, value]) => {
    const count = z.number().safeParse(value);
    return count.success && count.data > (hideSingles ? 1 : 0)
      ? [[label, count.data] as const]
      : [];
  });
  if (entries.length === 0) return null;

  return (
    <dl {...stylex.props(styles.impactList)}>
      {entries.map(([label, value]) => (
        <div {...stylex.props(styles.impactItem)} key={label}>
          <dd {...stylex.props(styles.impactValue)}>{value}</dd>
          <dt {...stylex.props(styles.lowercase)}>
            {label.replaceAll(/([A-Z])/g, " $1")}
          </dt>
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
    <div {...stylex.props(styles.notice, styles.warningNotice)}>
      <div {...stylex.props(styles.eyebrow)}>Warnings</div>
      <ul {...stylex.props(styles.bulletList)}>
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
      return <span {...stylex.props(styles.meta)}>Linked</span>;
    }
    return (
      <button
        aria-label={`${excluded ? "Include" : "Exclude"} ${labelField(field)}`}
        aria-pressed={!excluded}
        {...stylex.props(
          styles.toggle,
          excluded ? styles.toggleExcluded : styles.toggleIncluded,
        )}
        onClick={() => {
          const parsed = BottleOperationFieldPathSchema.safeParse(field);
          if (parsed.success) onToggleField(parsed.data);
        }}
        type="button"
      >
        {excluded ? "Skipped" : "Use"}
      </button>
    );
  }

  return (
    <div {...stylex.props(styles.diff)}>
      <div {...stylex.props(styles.mobileDiff)}>
        {fields.map((field) => {
          const excluded = excludedFields.has(field);
          return (
            <div
              key={field}
              {...stylex.props(styles.diffCard, excluded && styles.excluded)}
            >
              <div {...stylex.props(styles.diffCardHeader)}>
                <div
                  {...stylex.props(styles.diffLabel, excluded && styles.struck)}
                >
                  {labelField(field)}
                </div>
                {renderToggle(field, excluded)}
              </div>
              <dl {...stylex.props(styles.diffValues)}>
                <div {...stylex.props(styles.minWidth)}>
                  <dt {...stylex.props(styles.meta)}>Current</dt>
                  <dd {...stylex.props(styles.diffValue)}>
                    {formatValue(getPath(before, field))}
                  </dd>
                </div>
                <ArrowRight
                  aria-hidden="true"
                  {...stylex.props(styles.arrow)}
                />
                <div {...stylex.props(styles.minWidth)}>
                  <dt {...stylex.props(styles.meta)}>Proposed</dt>
                  <dd {...stylex.props(styles.diffValue, styles.strong)}>
                    {formatValue(getPath(after, field))}
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
      <table {...stylex.props(styles.diffTable)}>
        <thead>
          <tr {...stylex.props(styles.tableHeading)}>
            {onToggleField ? (
              <th {...stylex.props(styles.applyCell)}>Apply</th>
            ) : null}
            <th {...stylex.props(styles.tableCell)}>Field</th>
            <th {...stylex.props(styles.tableCell)}>Current</th>
            <th {...stylex.props(styles.tableLastCell)}>Proposed</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => {
            const excluded = excludedFields.has(field);
            return (
              <tr key={field} {...stylex.props(excluded && styles.excluded)}>
                {onToggleField ? (
                  <td {...stylex.props(styles.tableCell)}>
                    {renderToggle(field, excluded)}
                  </td>
                ) : null}
                <td {...stylex.props(styles.tableCell, styles.strong)}>
                  <span {...stylex.props(excluded && styles.struck)}>
                    {labelField(field)}
                  </span>
                </td>
                <td {...stylex.props(styles.tableCell, styles.muted)}>
                  {formatValue(getPath(before, field))}
                </td>
                <td {...stylex.props(styles.tableLastCell, styles.strong)}>
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
      <div {...stylex.props(styles.notice, styles.dangerNotice)}>
        {review.preparationError.message}
      </div>
    );
  }

  switch (review.type) {
    case "update_bottle":
      return (
        <div {...stylex.props(styles.preview)}>
          <div {...stylex.props(styles.eyebrow)}>Live Bottle diff</div>
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
        <div {...stylex.props(styles.preview)}>
          <div {...stylex.props(styles.copy)}>
            Retire{" "}
            <strong {...stylex.props(styles.strong)}>
              {review.preview.source.fullName}
            </strong>{" "}
            into{" "}
            <strong {...stylex.props(styles.strong)}>
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
        <div {...stylex.props(styles.preview)}>
          <div {...stylex.props(styles.eyebrow)}>Live Entity diff</div>
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
        <div {...stylex.props(styles.preview)}>
          <div {...stylex.props(styles.copy)}>
            Retire{" "}
            <strong {...stylex.props(styles.strong)}>
              {review.preview.source.name}
            </strong>{" "}
            into{" "}
            <strong {...stylex.props(styles.strong)}>
              {review.preview.destination.name}
            </strong>
            . Survivor kind: {review.preview.after.kind}.
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
          href={`/bottles/${proposal.input.bottleId}/edit`}
          key="bottle"
          {...stylex.props(styles.link)}
        >
          Edit Bottle #{proposal.input.bottleId}
        </Link>,
      ];
      break;
    case "merge_bottles":
      links = [
        <Link
          href={`/bottles/${proposal.input.sourceBottleId}/edit`}
          key="source"
          {...stylex.props(styles.link)}
        >
          Edit source Bottle
        </Link>,
        <Link
          href={`/bottles/${proposal.input.destinationBottleId}/edit`}
          key="destination"
          {...stylex.props(styles.link)}
        >
          Edit destination Bottle
        </Link>,
      ];
      break;
    case "update_entity":
      links = [
        <Link
          href={`/entities/${proposal.input.entityId}/edit`}
          key="entity"
          {...stylex.props(styles.link)}
        >
          Edit Entity #{proposal.input.entityId}
        </Link>,
      ];
      break;
    case "merge_entities":
      links = [
        <Link
          href={`/entities/${proposal.input.sourceEntityId}/edit`}
          key="source"
          {...stylex.props(styles.link)}
        >
          Edit source Entity
        </Link>,
        <Link
          href={`/entities/${proposal.input.destinationEntityId}/edit`}
          key="destination"
          {...stylex.props(styles.link)}
        >
          Edit destination Entity
        </Link>,
      ];
      break;
  }
  return <div {...stylex.props(styles.resourceLinks)}>{links}</div>;
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
    <div {...stylex.props(styles.notice)}>
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
    <ul {...stylex.props(styles.evidenceList)}>
      {evidence.map((ref) => {
        switch (ref.kind) {
          case "bottle":
            return (
              <li key={`bottle:${ref.bottleId}`}>
                Bottle evidence:{" "}
                <Link
                  href={`/bottles/${ref.bottleId}`}
                  {...stylex.props(styles.link)}
                >
                  #{ref.bottleId}
                </Link>
              </li>
            );
          case "entity":
            return (
              <li key={`entity:${ref.entityId}`}>
                Entity evidence:{" "}
                <Link
                  href={`/entities/${ref.entityId}`}
                  {...stylex.props(styles.link)}
                >
                  #{ref.entityId}
                </Link>
              </li>
            );
          case "web_result":
            return (
              <li key={ref.url}>
                Web evidence:{" "}
                <a
                  href={ref.url}
                  rel="noreferrer"
                  target="_blank"
                  {...stylex.props(styles.externalLink)}
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
    return Object.keys(proposal.input.patch).flatMap((field) => {
      const parsed = BottleOperationFieldPathSchema.safeParse(field);
      return parsed.success ? [parsed.data] : [];
    });
  }
  if (proposal.type === "update_bottle") {
    const sharedFields = new Set([
      "name",
      "seriesId",
      "category",
      "brand",
      "distillers",
      "bottler",
    ]);
    return Object.keys(proposal.input.patch).flatMap((field) => {
      const path = `${sharedFields.has(field) ? "shared" : "exact"}.${field}`;
      const parsed = BottleOperationFieldPathSchema.safeParse(path);
      return parsed.success ? [parsed.data] : [];
    });
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
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(
    null,
  );
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
  >(() => new Set(operation.excludedFields));
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
    const removal: PendingRemoval = {
      reason: rejectionReason,
    };
    if (rejectionNote.trim()) removal.note = rejectionNote.trim();
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
      <article {...stylex.props(styles.card, styles.warningCard)}>
        <div {...stylex.props(styles.cardHeader, styles.centeredHeader)}>
          <div>
            <Heading {...stylex.props(styles.cardTitle)}>
              {OPERATION_LABELS[operation.proposal.type]}
            </Heading>
            <p {...stylex.props(styles.copy)} role="status">
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
    <article {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.cardHeader)}>
        <div>
          <Heading {...stylex.props(styles.cardTitle)}>
            {OPERATION_LABELS[operation.proposal.type]}
          </Heading>
          {!compact ||
          operation.status !== "pending_review" ||
          notApprovalReady ? (
            <span {...stylex.props(styles.status)}>
              {notApprovalReady
                ? "Not ready to approve"
                : STATUS_LABELS[operation.status]}
            </span>
          ) : null}
        </div>
        {onCopy ? (
          <Button
            disabled={copying}
            icon={<Copy aria-hidden="true" {...stylex.props(styles.icon)} />}
            loading={copying}
            onClick={() => onCopy(operation.id)}
            size="small"
            title="Copy structured audit operation data as JSON"
          >
            <span {...stylex.props(styles.srOnly)}>Copy operation payload</span>
          </Button>
        ) : null}
      </div>

      {notApprovalReady ? (
        <p {...stylex.props(styles.copy, styles.accentCopy)} role="status">
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
        <p {...stylex.props(styles.copy)}>
          {excludedFields.size} proposed field
          {excludedFields.size === 1 ? " is" : "s are"} struck out and will not
          be applied.
        </p>
      ) : null}

      {operation.rejectionReason ? (
        <div {...stylex.props(styles.copy)}>
          Removed: {operation.rejectionReason.replaceAll("_", " ")}
          {operation.reviewerNote ? ` — ${operation.reviewerNote}` : ""}
        </div>
      ) : null}
      <ExecutionSummary operation={operation} />
      {operation.error ? (
        <div {...stylex.props(styles.notice, styles.dangerNotice)}>
          {operation.error}
        </div>
      ) : null}

      {actionError ? (
        <div {...stylex.props(styles.notice, styles.dangerNotice)}>
          {actionError}
        </div>
      ) : null}

      {canApply || canReject || canRetry ? (
        <div {...stylex.props(styles.actions)}>
          {canApply ? (
            <Button
              aria-label="Apply included changes"
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
              disabled={disabled}
              onClick={() => setRejecting((value) => !value)}
              size="small"
            >
              {compact ? "Remove" : "Remove operation"}
            </Button>
          ) : null}
          {canRetry ? (
            <Button
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

      <details {...stylex.props(styles.details)}>
        <summary {...stylex.props(styles.detailsSummary)}>
          {compact ? "Evidence" : "Evidence and reasoning"}
        </summary>
        <p {...stylex.props(styles.copy)}>{operation.proposal.rationale}</p>
        <EvidenceList evidence={operation.proposal.evidenceRefs} />
        <ResourceLinks operation={operation} />
      </details>

      {rejecting && canReject ? (
        <div ref={rejectionPanel} {...stylex.props(styles.rejectionPanel)}>
          <div {...stylex.props(styles.rejectionFields)}>
            <label {...stylex.props(styles.fieldLabel)}>
              Reason
              <select
                disabled={disabled}
                onChange={(event) => {
                  const reason = REJECTION_REASONS.find(
                    ({ id }) => id === event.currentTarget.value,
                  );
                  if (reason) setRejectionReason(reason.id);
                }}
                value={rejectionReason}
                {...stylex.props(styles.input)}
              >
                {REJECTION_REASONS.map((reason) => (
                  <option key={reason.id} value={reason.id}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </label>
            <label {...stylex.props(styles.fieldLabel)}>
              Note {rejectionReason === "other" ? "(required)" : "(optional)"}
              <input
                disabled={disabled}
                onChange={(event) =>
                  setRejectionNote(event.currentTarget.value)
                }
                value={rejectionNote}
                {...stylex.props(styles.input)}
              />
            </label>
          </div>
          <div {...stylex.props(styles.rejectionActions)}>
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

const styles = stylex.create({
  minWidth: { minWidth: 0 },
  card: {
    boxSizing: "border-box",
    padding: { default: space.x6, "@media (max-width: 639px)": space.x4 },
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  warningCard: {
    borderLeftWidth: "3px",
    borderLeftColor: colors.accent,
    backgroundColor: colors.accentTint,
  },
  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.x3,
    flexWrap: "wrap",
  },
  centeredHeader: { alignItems: "center" },
  cardTitle: {
    margin: 0,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "16px",
    fontWeight: 600,
  },
  status: {
    display: "inline-block",
    marginTop: space.x2,
    padding: "4px 10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: "999px",
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontWeight: 600,
  },
  preview: { marginTop: space.x4 },
  eyebrow: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  copy: {
    margin: 0,
    marginTop: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.5,
  },
  accentCopy: { color: colors.accentDeep },
  strong: { color: colors.ink, fontWeight: 600 },
  muted: { color: colors.inkMuted },
  meta: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  impactList: {
    display: "flex",
    margin: 0,
    marginTop: space.x3,
    padding: 0,
    gap: `${space.x1} ${space.x4}`,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    flexWrap: "wrap",
  },
  impactItem: { display: "flex", gap: space.x1 },
  impactValue: { margin: 0, color: colors.ink, fontWeight: 600 },
  lowercase: { textTransform: "lowercase" },
  notice: {
    marginTop: space.x4,
    padding: space.x3,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.5,
  },
  warningNotice: {
    borderLeftWidth: "3px",
    borderLeftColor: colors.accent,
    backgroundColor: colors.accentTint,
  },
  dangerNotice: {
    borderLeftWidth: "3px",
    borderLeftColor: colors.accentDeep,
    color: colors.ink,
  },
  bulletList: {
    display: "grid",
    margin: 0,
    marginTop: space.x2,
    paddingLeft: space.x6,
    gap: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    listStyleType: "disc",
  },
  toggle: {
    minHeight: "36px",
    padding: "4px 10px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderRadius: controlMetrics.radius,
    outline: "none",
    fontFamily: fonts.data,
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
  },
  toggleExcluded: {
    borderColor: colors.hairline,
    backgroundColor: "transparent",
    color: { default: colors.inkMuted, ":hover": colors.ink },
  },
  toggleIncluded: {
    borderColor: colors.accent,
    backgroundColor: {
      default: colors.accentTint,
      ":hover": colors.inset,
    },
    color: colors.accentDeep,
  },
  diff: { marginTop: space.x3 },
  mobileDiff: {
    display: { default: "none", "@media (max-width: 639px)": "grid" },
    gap: space.x2,
  },
  diffCard: {
    padding: space.x3,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
  },
  diffCardHeader: {
    display: "flex",
    minHeight: "36px",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x3,
  },
  diffLabel: {
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    fontWeight: 600,
  },
  diffValues: {
    display: "grid",
    margin: 0,
    marginTop: space.x3,
    gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)",
    alignItems: "start",
    gap: space.x2,
  },
  diffValue: {
    margin: 0,
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    overflowWrap: "anywhere",
  },
  arrow: {
    width: "16px",
    height: "16px",
    marginTop: "20px",
    color: colors.hairline,
  },
  diffTable: {
    display: { default: "table", "@media (max-width: 639px)": "none" },
    width: "100%",
    borderCollapse: "collapse",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
  },
  tableHeading: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    letterSpacing: "0.05em",
    textAlign: "left",
    textTransform: "uppercase",
  },
  tableCell: {
    paddingTop: space.x2,
    paddingRight: space.x4,
    paddingBottom: space.x2,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  tableLastCell: {
    paddingTop: space.x2,
    paddingBottom: space.x2,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  applyCell: {
    width: "80px",
    paddingTop: space.x2,
    paddingRight: space.x4,
    paddingBottom: space.x2,
  },
  excluded: { opacity: 0.5 },
  struck: { textDecoration: "line-through" },
  resourceLinks: {
    display: "flex",
    marginTop: space.x3,
    gap: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    flexWrap: "wrap",
  },
  link: {
    color: { default: colors.inkMuted, ":hover": colors.accentDeep },
    textDecoration: "underline",
  },
  externalLink: {
    color: { default: colors.inkMuted, ":hover": colors.accentDeep },
    textDecoration: "underline",
    overflowWrap: "anywhere",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  evidenceList: {
    display: "grid",
    margin: 0,
    marginTop: space.x2,
    padding: 0,
    gap: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    listStyle: "none",
  },
  icon: { width: "20px", height: "20px" },
  srOnly: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
  actions: {
    display: "flex",
    marginTop: space.x4,
    paddingTop: space.x4,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    gap: space.x2,
    flexWrap: "wrap",
  },
  details: {
    marginTop: space.x4,
    paddingTop: space.x3,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
  },
  detailsSummary: {
    color: { default: colors.inkMuted, ":hover": colors.ink },
    fontFamily: fonts.reading,
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  rejectionPanel: {
    marginTop: space.x3,
    padding: space.x3,
    scrollMarginBottom: "128px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
  },
  rejectionFields: {
    display: "grid",
    gridTemplateColumns: {
      default: "180px minmax(0,1fr)",
      "@media (max-width: 639px)": "minmax(0,1fr)",
    },
    gap: space.x3,
  },
  fieldLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
  },
  input: {
    boxSizing: "border-box",
    display: "block",
    width: "100%",
    minHeight: "40px",
    marginTop: space.x1,
    padding: `${space.x2} ${space.x3}`,
    borderWidth: 0,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: colors.surface,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
  },
  rejectionActions: {
    display: "flex",
    marginTop: space.x3,
    gap: space.x2,
    flexWrap: "wrap",
  },
});
