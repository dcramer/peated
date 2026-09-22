"use client";

import {
  REPORT_REASON_LABELS,
  ReportReasonEnum,
} from "@peated/server/schemas/reports";
import { useId, useState } from "react";
import type { z } from "zod";

import { Field, Textarea } from "@peated/web/components/field.stylex";
import { Select } from "@peated/web/components/formControls.stylex";
import { FormDialog } from "@peated/web/components/formDialog.stylex";

export type ReportReason = z.infer<typeof ReportReasonEnum>;

export type ReportInput = { reason: ReportReason; comment?: string };

export type ReportDialogProps = {
  isOpen: boolean;
  onCancel: () => void;
  /** Sends the report. Throw to keep the dialog open with the error. */
  onSubmit: (input: ReportInput) => Promise<void>;
  /** What is being reported, such as "this tasting" or "@islaydrinker". */
  subject: string;
};

/** Collects a reason and an optional note before a report is sent. */
export function ReportDialog({
  isOpen,
  onCancel,
  onSubmit,
  subject,
}: ReportDialogProps) {
  return isOpen ? (
    <ReportDialogForm
      onCancel={onCancel}
      onSubmit={onSubmit}
      subject={subject}
    />
  ) : null;
}

// Mounted only while open so the fields reset between reports.
function ReportDialogForm({
  onCancel,
  onSubmit,
  subject,
}: Omit<ReportDialogProps, "isOpen">) {
  const reasonId = useId();
  const commentId = useId();
  const [reason, setReason] = useState<ReportReason | "">("");
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  // "Something else" means nothing to moderators without the details.
  const needsDetails = reason === "other";
  const ready = reason !== "" && (!needsDetails || comment.trim() !== "");

  async function submit() {
    if (reason === "") return;
    setPending(true);
    setError(undefined);
    try {
      await onSubmit({ reason, comment: comment.trim() || undefined });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to send the report.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <FormDialog
      error={error}
      isOpen
      message={`Tell us what is wrong with ${subject}. Moderators review every report and never share who sent it.`}
      onCancel={onCancel}
      onSubmit={() => void submit()}
      pending={pending}
      pendingLabel="Sending…"
      submitDisabled={!ready}
      submitLabel="Send report"
      title="Report to moderators"
    >
      <Field htmlFor={reasonId} label="Reason" required>
        <Select
          disabled={pending}
          id={reasonId}
          onChange={(event) =>
            setReason(
              event.currentTarget.value === ""
                ? ""
                : ReportReasonEnum.parse(event.currentTarget.value),
            )
          }
          value={reason}
        >
          <option value="">Choose a reason</option>
          {ReportReasonEnum.options.map((value) => (
            <option key={value} value={value}>
              {REPORT_REASON_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        htmlFor={commentId}
        label="Details"
        optional={!needsDetails}
        required={needsDetails}
      >
        <Textarea
          disabled={pending}
          id={commentId}
          maxLength={1000}
          onChange={(event) => setComment(event.currentTarget.value)}
          placeholder={
            needsDetails
              ? "Tell moderators what is wrong."
              : "Anything that helps moderators understand the problem."
          }
          rows={3}
          value={comment}
        />
      </Field>
    </FormDialog>
  );
}
