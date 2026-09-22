"use client";

import { useId, useState, type ReactNode } from "react";

import { Field, TextInput } from "@peated/web/components/field.stylex";
import { FormDialog } from "@peated/web/components/formDialog.stylex";

export type ConfirmationDialogProps = {
  /** Requires the person to type `value` before they can continue. */
  confirmation?: { label: ReactNode; value: string };
  continueLabel?: string;
  /** A failure from the last attempt. The dialog stays open so they can retry. */
  error?: ReactNode;
  isOpen: boolean;
  message?: ReactNode;
  onCancel: () => void;
  onContinue: () => void;
  /** True while the action runs. Continue shows progress and Cancel waits. */
  pending?: boolean;
  pendingLabel?: string;
  title?: string;
};

/**
 * Asks before an action that is hard to undo. For an account-level action,
 * pass `confirmation` so the person types the name of what they are removing.
 */
export default function ConfirmationDialog({
  isOpen,
  ...props
}: ConfirmationDialogProps) {
  // Mounted only while open so the typed value resets.
  return isOpen ? <ConfirmationDialogForm {...props} /> : null;
}

function ConfirmationDialogForm({
  confirmation,
  continueLabel = "Continue",
  error,
  message = "Are you sure you want to continue with this action?",
  onCancel,
  onContinue,
  pending = false,
  pendingLabel,
  title = "Warning",
}: Omit<ConfirmationDialogProps, "isOpen">) {
  const inputId = useId();
  const [typed, setTyped] = useState("");

  const confirmed =
    !confirmation ||
    typed.trim().toLowerCase() === confirmation.value.trim().toLowerCase();

  return (
    <FormDialog
      error={error}
      isOpen
      message={message}
      onCancel={onCancel}
      onSubmit={onContinue}
      pending={pending}
      pendingLabel={pendingLabel}
      submitDisabled={!confirmed}
      submitLabel={continueLabel}
      submitVariant="danger"
      title={title}
    >
      {confirmation ? (
        <Field htmlFor={inputId} label={confirmation.label}>
          <TextInput
            autoComplete="off"
            autoFocus
            disabled={pending}
            id={inputId}
            onChange={(event) => setTyped(event.currentTarget.value)}
            spellCheck={false}
            value={typed}
          />
        </Field>
      ) : null}
    </FormDialog>
  );
}
