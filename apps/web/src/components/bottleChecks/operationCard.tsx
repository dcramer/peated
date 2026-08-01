import type { Outputs } from "@peated/server/orpc/router";
import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import type { ReactNode } from "react";

type Details = Outputs["bottleChecks"]["details"];
export type BottleOperation = Details["check"]["operations"][number];
export type BottleOperationReview = NonNullable<
  Details["reviewOperations"][number]["review"]
>;
export type BottleOperationEvidence =
  BottleOperation["proposal"]["evidenceRefs"][number];

const STATUS_LABELS: Record<BottleOperation["status"], string> = {
  blocked: "Blocked",
  pending_review: "Pending review",
  rejected: "Rejected",
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
  values,
}: {
  values: Record<string, number | undefined>;
}) {
  const entries = Object.entries(values).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number",
  );
  if (entries.length === 0) return null;

  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {entries.map(([label, value]) => (
        <div
          className="rounded border border-slate-800 bg-slate-950 px-3 py-2"
          key={label}
        >
          <dt className="text-xs capitalize text-slate-400">
            {label.replaceAll(/([A-Z])/g, " $1")}
          </dt>
          <dd className="text-sm font-semibold text-white">{value}</dd>
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
  fields,
  labelField = formatFieldLabel,
}: {
  after: unknown;
  before: unknown;
  fields: string[];
  labelField?: (field: string) => string;
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-4">Field</th>
            <th className="py-2 pr-4">Current</th>
            <th className="py-2">Proposed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {fields.map((field) => (
            <tr key={field}>
              <td className="py-2 pr-4 font-medium text-slate-300">
                {labelField(field)}
              </td>
              <td className="py-2 pr-4 text-slate-400">
                {formatValue(getPath(before, field))}
              </td>
              <td className="py-2 text-white">
                {formatValue(getPath(after, field))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Preview({ review }: { review: BottleOperationReview }) {
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
            fields={review.preview.changedFields}
            labelField={formatBottleFieldLabel}
          />
          <ImpactList
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
            fields={review.preview.changedFields}
          />
          <ImpactList values={review.preview.impact} />
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

export default function OperationCard({
  approvalReady = false,
  checked = false,
  disabled = false,
  executionEnabled = true,
  onRetry,
  onSelect,
  operation,
  review,
  showDisposition = true,
}: {
  approvalReady?: boolean;
  checked?: boolean;
  disabled?: boolean;
  executionEnabled?: boolean;
  onRetry?: (operationId: number) => void;
  onSelect?: (operationId: number, selected: boolean) => void;
  operation: BottleOperation;
  review: BottleOperationReview | null;
  showDisposition?: boolean;
}) {
  const selectable =
    showDisposition && !!onSelect && isBottleOperationRejectable(operation);
  const notApprovalReady =
    showDisposition && operation.status === "pending_review" && !approvalReady;

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">
            {OPERATION_LABELS[operation.proposal.type]}
          </h3>
          <span className="mt-2 inline-block rounded-full border border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-200">
            {notApprovalReady
              ? "Not ready to approve"
              : STATUS_LABELS[operation.status]}
          </span>
        </div>
        {selectable ? (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              checked={checked}
              disabled={disabled}
              onChange={(event) =>
                onSelect?.(operation.id, event.currentTarget.checked)
              }
              type="checkbox"
            />
            Select
          </label>
        ) : null}
      </div>

      <p className="mt-4 text-sm text-slate-200">
        {operation.proposal.rationale}
      </p>
      <ResourceLinks operation={operation} />

      <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Evidence
        </div>
        <EvidenceList evidence={operation.proposal.evidenceRefs} />
      </div>

      {notApprovalReady ? (
        <div
          className="mt-4 rounded border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-100"
          role="status"
        >
          This operation cannot currently be approved, but you can reject it.
        </div>
      ) : null}

      {review ? <Preview review={review} /> : null}

      {operation.rejectionReason ? (
        <div className="mt-4 text-sm text-slate-300">
          Rejected: {operation.rejectionReason.replaceAll("_", " ")}
          {operation.reviewerNote ? ` — ${operation.reviewerNote}` : ""}
        </div>
      ) : null}
      <ExecutionSummary operation={operation} />
      {operation.error ? (
        <div className="mt-4 rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
          {operation.error}
        </div>
      ) : null}
      {showDisposition &&
      executionEnabled &&
      onRetry &&
      operation.status === "failed" ? (
        <div className="mt-4">
          <Button
            disabled={disabled}
            onClick={() => onRetry(operation.id)}
            size="small"
          >
            Retry failed operation
          </Button>
        </div>
      ) : null}
    </article>
  );
}
