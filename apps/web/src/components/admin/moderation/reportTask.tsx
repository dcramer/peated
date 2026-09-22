"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { REPORT_REASON_LABELS } from "@peated/server/schemas/reports";
import { AdminButton as Button } from "@peated/web/components/admin/adminButton.stylex";
import { AdminSection } from "@peated/web/components/admin/adminContent.stylex";
import { AdminTextareaField } from "@peated/web/components/admin/adminForm.stylex";
import { AdminAlert as Alert } from "@peated/web/components/admin/adminUtility.stylex";
import { TextLink } from "@peated/web/components/textLink.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import {
  ModerationActions,
  ModerationStack,
  ModerationTaskHeader,
} from "./moderationDetail.stylex";

type Task = Outputs["admin"]["moderation"]["listTasks"]["results"][number];
type Report = Outputs["admin"]["reports"]["details"];

const OBJECT_LABELS = {
  tasting: "tasting",
  member_review: "review",
  comment: "comment",
  user: "member",
} satisfies Record<Report["objectType"], string>;

/** One member report in the Inbox: who, what, why, and the follow-up actions. */
export function ReportTask({
  task,
  onComplete,
}: {
  task: Task;
  onComplete: (message: string) => Promise<void>;
}) {
  if (task.source.kind !== "report") {
    throw new Error("ReportTask requires a report source.");
  }
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { data: report } = useSuspenseQuery(
    orpc.admin.reports.details.queryOptions({
      input: { report: task.source.reportId },
    }),
  );
  const close = useMutation(orpc.admin.reports.close.mutationOptions());
  const removeContent = useMutation(
    orpc.admin.content.moderate.mutationOptions(),
  );
  const deleteComment = useMutation(orpc.comments.delete.mutationOptions());
  const suspend = useMutation(orpc.users.suspensionUpdate.mutationOptions());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy =
    close.isPending ||
    removeContent.isPending ||
    deleteComment.isPending ||
    suspend.isPending;
  const reasonLabel = REPORT_REASON_LABELS[report.reason];
  const contentUrl = report.contentUrl;
  const contentExists = contentUrl !== null;
  const objectLabel = OBJECT_LABELS[report.objectType];

  async function finish<TResult>(
    action: () => Promise<TResult>,
    message: string,
  ): Promise<void> {
    setError(null);
    try {
      await action();
      await queryClient.invalidateQueries({
        queryKey: orpc.admin.reports.key(),
      });
      await onComplete(message);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The decision could not be saved.",
      );
    }
  }

  const closeReport = (status: "resolved" | "dismissed") =>
    close.mutateAsync({
      report: report.id,
      status,
      note: note.trim() || undefined,
    });

  return (
    <ModerationStack>
      <ModerationTaskHeader
        blocked={false}
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
      <AdminSection title="Report">
        <p>
          <strong>{reasonLabel}</strong>
          {report.comment ? <> — {report.comment}</> : null}
        </p>
        <p>
          Reported by{" "}
          <TextLink href={`/users/${report.createdBy.username}`}>
            @{report.createdBy.username}
          </TextLink>{" "}
          about{" "}
          <TextLink href={`/users/${report.reportedUser.username}`}>
            @{report.reportedUser.username}
          </TextLink>
          {report.reportedUser.suspended ? " (suspended)" : null}
          {report.openReportCount > 0
            ? ` · ${report.openReportCount} other open ${
                report.openReportCount === 1 ? "report" : "reports"
              } about this ${objectLabel}`
            : null}
        </p>
        {contentUrl !== null ? (
          <p>
            <TextLink href={contentUrl}>View the {objectLabel}</TextLink>
            {report.contentPreview ? <> — {report.contentPreview}</> : null}
          </p>
        ) : (
          <p>This {objectLabel} is no longer available.</p>
        )}
      </AdminSection>
      <AdminSection title="Decision">
        <ModerationStack>
          <AdminTextareaField
            helpText="Also used as the removal or suspension reason."
            label="Moderator note"
            maxLength={500}
            onChange={(event) => setNote(event.currentTarget.value)}
            value={note}
          />
          {error ? <Alert type="error">{error}</Alert> : null}
          <ModerationActions>
            {contentExists &&
            (report.objectType === "tasting" ||
              report.objectType === "member_review") ? (
              <Button
                disabled={busy}
                loading={removeContent.isPending}
                onClick={() =>
                  void finish(async () => {
                    await removeContent.mutateAsync({
                      kind:
                        report.objectType === "tasting"
                          ? "tasting"
                          : "member_review",
                      id: report.objectId,
                      removed: true,
                      reason: note.trim() || reasonLabel,
                    });
                    await closeReport("resolved");
                  }, `${objectLabel} removed and report resolved.`)
                }
                variant="danger"
              >
                Remove {objectLabel} and resolve
              </Button>
            ) : null}
            {contentExists && report.objectType === "comment" ? (
              <Button
                disabled={busy}
                loading={deleteComment.isPending}
                onClick={() =>
                  void finish(async () => {
                    await deleteComment.mutateAsync({
                      comment: report.objectId,
                    });
                    await closeReport("resolved");
                  }, "Comment deleted and report resolved.")
                }
                variant="danger"
              >
                Delete comment and resolve
              </Button>
            ) : null}
            {report.reportedUser.suspended ? null : (
              <Button
                disabled={busy}
                loading={suspend.isPending}
                onClick={() =>
                  void finish(async () => {
                    await suspend.mutateAsync({
                      user: report.reportedUser.id,
                      suspended: true,
                      reason: note.trim() || reasonLabel,
                    });
                    await closeReport("resolved");
                  }, "Member suspended and report resolved.")
                }
                variant="danger"
              >
                Suspend member and resolve
              </Button>
            )}
            <Button
              disabled={busy}
              loading={close.isPending}
              onClick={() =>
                void finish(() => closeReport("resolved"), "Report resolved.")
              }
              variant="accent"
            >
              Mark resolved
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void finish(() => closeReport("dismissed"), "Report dismissed.")
              }
            >
              Dismiss
            </Button>
          </ModerationActions>
        </ModerationStack>
      </AdminSection>
    </ModerationStack>
  );
}
