"use client";

import { useId, useState } from "react";

import { Field, Textarea } from "@peated/web/components/field.stylex";
import { FormDialog } from "@peated/web/components/formDialog.stylex";

export type SuspendMemberDialogProps = {
  isOpen: boolean;
  onCancel: () => void;
  /** Suspends the member. Throw to keep the dialog open with the error. */
  onSubmit: (reason: string) => Promise<void>;
  username: string;
};

/** Asks a moderator why a member is being suspended. */
export function SuspendMemberDialog({
  isOpen,
  onCancel,
  onSubmit,
  username,
}: SuspendMemberDialogProps) {
  return isOpen ? (
    <SuspendMemberForm
      onCancel={onCancel}
      onSubmit={onSubmit}
      username={username}
    />
  ) : null;
}

function SuspendMemberForm({
  onCancel,
  onSubmit,
  username,
}: Omit<SuspendMemberDialogProps, "isOpen">) {
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function submit() {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await onSubmit(reason.trim());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to suspend member.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <FormDialog
      error={error}
      isOpen
      message={`@${username} will be locked out of Peated until reinstated. They can only delete their account or cancel a pending deletion.`}
      onCancel={onCancel}
      onSubmit={() => void submit()}
      pending={pending}
      pendingLabel="Suspending…"
      submitLabel="Suspend member"
      submitVariant="danger"
      title={`Suspend @${username}`}
    >
      <Field
        hint="The member sees this reason."
        htmlFor={reasonId}
        label="Reason"
        required
      >
        <Textarea
          disabled={pending}
          id={reasonId}
          maxLength={500}
          onChange={(event) => setReason(event.currentTarget.value)}
          rows={3}
          value={reason}
        />
      </Field>
    </FormDialog>
  );
}
