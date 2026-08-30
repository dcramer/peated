"use client";

import { BottleCreateInputSchema } from "@peated/server/lib/bottleSchemas";
import type { Inputs, Outputs } from "@peated/server/orpc/router";
import type { Bottle } from "@peated/server/types";
import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import {
  AdminCodeBlock,
  AdminDetails,
  AdminSection,
  AdminTextLink,
} from "@peated/web/components/admin/adminContent.stylex";
import {
  AdminSelectField,
  AdminTextareaField,
} from "@peated/web/components/admin/adminForm.stylex";
import {
  AdminAlert as Alert,
  AdminDefinitionList as DefinitionList,
} from "@peated/web/components/admin/adminUtility.stylex";
import CheckResult from "@peated/web/components/bottleChecks/checkResult.stylex";
import type { ExcludedOperationField } from "@peated/web/components/bottleChecks/operationCard.stylex";
import OperationCard from "@peated/web/components/bottleChecks/operationCard.stylex";
import { copyTextToClipboard } from "@peated/web/lib/clipboard";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Check, Copy, RotateCcw } from "lucide-react";
import { Fragment, useState } from "react";
import { z } from "zod";
import BottleSelector from "./bottleSelector";
import { formatPriceMatchQueueLlmExport } from "./llmExport";
import {
  ModerationActions,
  ModerationLoading,
  ModerationMedia,
  ModerationStack,
  ModerationTaskHeader,
} from "./moderationDetail.stylex";

type Task = Outputs["admin"]["moderation"]["listTasks"]["results"][number];
type QueueItem = Outputs["prices"]["matchQueue"]["details"];
type RejectionReason = Inputs["audits"]["rejectSelected"]["reason"];
type CloseReason = Inputs["audits"]["close"]["reason"];
type ProposedBottleField = NonNullable<
  QueueItem["proposedBottle"]
>[keyof NonNullable<QueueItem["proposedBottle"]>];

function errorMessage(error: Error): string {
  return error instanceof Error
    ? error.message
    : "The decision could not be saved.";
}

function formatField(value: ProposedBottleField): string {
  if (value === null || value === undefined || value === "")
    return "Not provided";
  if (Array.isArray(value)) return value.map(formatField).join(", ");
  const namedValue = z.object({ name: z.string() }).safeParse(value);
  if (namedValue.success) return namedValue.data.name;
  const booleanValue = z.boolean().safeParse(value);
  if (booleanValue.success) return booleanValue.data ? "Yes" : "No";
  const scalarValue = z.union([z.string(), z.number()]).safeParse(value);
  if (scalarValue.success) return scalarValue.data.toString();
  return JSON.stringify(value);
}

function TaskHeader({ task }: { task: Task }) {
  return (
    <ModerationTaskHeader
      blocked={task.state === "blocked"}
      category={task.category}
      meta={
        <>
          {task.title} · {task.sourceLabel}
        </>
      }
      question={task.question}
      status={task.statusLabel}
      taskKey={task.key}
    />
  );
}

function ListingTask({
  task,
  onComplete,
}: {
  task: Task;
  onComplete: (message: string) => Promise<void>;
}) {
  if (task.source.kind !== "listing") {
    throw new Error("ListingTask requires a listing source.");
  }
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
  const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const busy =
    resolve.isPending ||
    createBottle.isPending ||
    repair.isPending ||
    retry.isPending;

  async function finish<TResult>(
    action: () => Promise<TResult>,
    message: string,
  ) {
    setError(null);
    try {
      await action();
      await queryClient.invalidateQueries({
        queryKey: orpc.prices.matchQueue.key(),
      });
      await onComplete(message);
    } catch (cause) {
      setError(
        errorMessage(
          cause instanceof Error ? cause : new Error("Non-Error thrown"),
        ),
      );
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

  async function copyDetails() {
    setCopyStatus("copying");
    setError(null);
    try {
      await copyTextToClipboard(formatPriceMatchQueueLlmExport(item));
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    } catch (cause) {
      setCopyStatus("idle");
      setError(
        errorMessage(
          cause instanceof Error ? cause : new Error("Non-Error thrown"),
        ),
      );
    }
  }

  function retryClassification() {
    return finish(
      () => retry.mutateAsync({ proposal: item.id }),
      "Listing requeued for classification.",
    );
  }

  const primary = (() => {
    if (item.status === "errored") {
      return (
        <Button
          color="highlight"
          disabled={busy}
          icon={<RotateCcw aria-hidden="true" size={16} />}
          loading={retry.isPending}
          onClick={() => void retryClassification()}
        >
          Retry classification
        </Button>
      );
    }
    if (item.proposalType === "match_existing" && item.suggestedBottle) {
      return (
        <Button
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
    <ModerationStack>
      <TaskHeader task={task} />
      <AdminSection title="Source listing">
        <ModerationMedia imageUrl={item.price.imageUrl}>
          <strong>{item.price.name}</strong>
          <div>
            {item.price.site.name} ·{" "}
            {(item.price.price / 100).toLocaleString(undefined, {
              style: "currency",
              currency: item.price.currency.toUpperCase(),
            })}
          </div>
          <AdminTextLink href={item.price.url}>
            Open source listing
          </AdminTextLink>
        </ModerationMedia>
      </AdminSection>

      {item.suggestedBottle ? (
        <AdminSection title="Recommended bottle" tone="accent">
          <strong>{item.suggestedBottle.fullName}</strong>
          {" · "}
          <AdminTextLink href={`/bottles/${item.suggestedBottle.id}`}>
            View bottle #{item.suggestedBottle.id}
          </AdminTextLink>
        </AdminSection>
      ) : null}

      {item.proposedBottle ? (
        <AdminSection title="Proposed bottle">
          <DefinitionList>
            {Object.entries(item.proposedBottle).map(([field, value]) => (
              <Fragment key={field}>
                <DefinitionList.Term>
                  {field.replaceAll("_", " ")}
                </DefinitionList.Term>
                <DefinitionList.Details>
                  {formatField(value)}
                </DefinitionList.Details>
              </Fragment>
            ))}
          </DefinitionList>
        </AdminSection>
      ) : null}

      {item.error ? (
        <Alert type="warn">
          <strong>Classification needs attention.</strong>
          <p>{item.error}</p>
        </Alert>
      ) : null}
      {item.proposalType === "no_match" && item.status !== "errored" ? (
        <Alert type="default">
          <strong>No clear Bottle outcome was found.</strong>
          <p>
            Choose a Bottle if you recognize the listing. Otherwise, ignore it
            to remove it from moderation without assigning a Bottle.
          </p>
        </Alert>
      ) : null}
      {item.rationale ? (
        <AdminSection title="Rationale">{item.rationale}</AdminSection>
      ) : null}
      {error ? <Alert type="error">{error}</Alert> : null}

      <ModerationActions>
        {primary}
        <Button disabled={busy} onClick={() => setSelecting(true)}>
          {item.suggestedBottle ? "Choose another Bottle" : "Choose Bottle"}
        </Button>
        {item.status !== "errored" ? (
          <Button
            disabled={busy || item.isProcessing}
            icon={<RotateCcw aria-hidden="true" size={16} />}
            loading={retry.isPending}
            onClick={() => void retryClassification()}
          >
            Retry classification
          </Button>
        ) : null}
        <Button
          disabled={copyStatus === "copying"}
          icon={
            copyStatus === "copied" ? (
              <Check aria-hidden="true" size={16} />
            ) : (
              <Copy aria-hidden="true" size={16} />
            )
          }
          loading={copyStatus === "copying"}
          onClick={() => void copyDetails()}
          title="Copy structured listing, identity, evidence, and recommendation data as JSON"
        >
          {copyStatus === "copied" ? "Copied details" : "Copy details"}
        </Button>
        {item.proposalType === "create_new" && item.proposedBottle ? (
          <Button
            href={`/bottles/new?name=${encodeURIComponent(item.proposedBottle.name)}`}
          >
            Edit before creation
          </Button>
        ) : null}
        <Button
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
      </ModerationActions>

      <AdminDetails summary="Evidence">
        <ModerationStack>
          {item.searchEvidence.length ? (
            item.searchEvidence.map((evidence, index) => (
              <AdminCodeBlock key={index}>
                {JSON.stringify(evidence, null, 2)}
              </AdminCodeBlock>
            ))
          ) : (
            <p>No supporting web evidence was saved.</p>
          )}
        </ModerationStack>
      </AdminDetails>
      <AdminDetails summary="System details">
        <DefinitionList>
          <DefinitionList.Term>Proposal</DefinitionList.Term>
          <DefinitionList.Details>#{item.id}</DefinitionList.Details>
          <DefinitionList.Term>Model</DefinitionList.Term>
          <DefinitionList.Details>
            {item.model ?? "Unavailable"}
          </DefinitionList.Details>
          <DefinitionList.Term>Automation score</DefinitionList.Term>
          <DefinitionList.Details>
            {item.automationScore ?? "Unavailable"}
          </DefinitionList.Details>
          <DefinitionList.Term>Status</DefinitionList.Term>
          <DefinitionList.Details>{item.status}</DefinitionList.Details>
        </DefinitionList>
      </AdminDetails>

      <BottleSelector
        name={item.price.name}
        onClose={() => setSelecting(false)}
        onSelect={selectBottle}
        open={selecting}
        source={item.price.url}
      />
    </ModerationStack>
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
      setError(
        errorMessage(
          cause instanceof Error ? cause : new Error("Non-Error thrown"),
        ),
      );
    }
  }

  async function remove(
    operationId: number,
    reason: RejectionReason,
    note?: string,
  ) {
    setError(null);
    try {
      const input: Inputs["audits"]["rejectSelected"] = {
        audit: data.audit.id,
        operationIds: [operationId],
        reason,
      };
      if (note) input.note = note;
      const result = await reject.mutateAsync(input);
      const action = result.results[0];
      if (!action || action.error)
        throw new Error(action?.error ?? "The operation returned no result.");
      await refreshAndComplete("Suggested change removed.");
    } catch (cause) {
      setError(
        errorMessage(
          cause instanceof Error ? cause : new Error("Non-Error thrown"),
        ),
      );
    }
  }

  async function closeFindings() {
    setError(null);
    try {
      const input: Inputs["audits"]["close"] = {
        audit: data.audit.id,
        reason: closeReason,
      };
      if (closeNote.trim()) input.note = closeNote.trim();
      await close.mutateAsync(input);
      await refreshAndComplete("Findings disposition recorded.");
    } catch (cause) {
      setError(
        errorMessage(
          cause instanceof Error ? cause : new Error("Non-Error thrown"),
        ),
      );
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
      <ModerationStack>
        <TaskHeader task={task} />
        {error ? <Alert type="error">{error}</Alert> : null}
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
        <AdminDetails summary="System details">
          <p>
            Audit #{data.audit.id} · Operation #{operation.id} · Schema{" "}
            {data.audit.schemaVersion}
          </p>
        </AdminDetails>
      </ModerationStack>
    );
  }

  return (
    <ModerationStack>
      <TaskHeader task={task} />
      <CheckResult check={data.audit} compact title="Unresolved findings" />
      {data.audit.bottleId ? (
        <Button href={`/bottles/${data.audit.bottleId}/edit`}>
          Edit Bottle manually
        </Button>
      ) : null}
      <AdminSection title="Record disposition">
        <ModerationStack>
          <AdminSelectField
            label="Reason"
            options={[
              { value: "dismissed", label: "Dismissed" },
              { value: "resolved_manually", label: "Resolved manually" },
            ]}
            onChange={(event) =>
              setCloseReason(
                z
                  .enum(["dismissed", "resolved_manually"])
                  .parse(event.currentTarget.value),
              )
            }
            value={closeReason}
          />
          <AdminTextareaField
            label="Optional note"
            onChange={(event) => setCloseNote(event.currentTarget.value)}
            value={closeNote}
          />
          {error ? <Alert type="error">{error}</Alert> : null}
          <Button
            color="highlight"
            disabled={busy}
            loading={close.isPending}
            onClick={() => void closeFindings()}
          >
            Close findings
          </Button>
        </ModerationStack>
      </AdminSection>
    </ModerationStack>
  );
}

export function UnavailableTask() {
  return (
    <AdminSection title="This task no longer needs attention">
      <p>
        It may have been completed in another session. The Inbox has been
        refreshed.
      </p>
      <Button href="/admin/moderation/inbox">Return to Inbox</Button>
    </AdminSection>
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
    return <ModerationLoading>Loading decision…</ModerationLoading>;
  if (locator.isError || !locator.data) return <UnavailableTask />;
  const task = locator.data.task;
  if (task.source.kind === "listing")
    return <ListingTask onComplete={onComplete} task={task} />;
  return <AuditTask onComplete={onComplete} task={task} />;
}
