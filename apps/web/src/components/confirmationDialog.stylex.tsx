"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import * as stylex from "@stylexjs/stylex";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { SectionHeading } from "./sectionHeading.stylex";

import { Button } from "@peated/web/components/button.stylex";
import { FlashMessage } from "@peated/web/components/feedback.stylex";
import { Field, TextInput } from "@peated/web/components/field.stylex";
import { foundationStyles } from "../styles/foundations.stylex";
import { colors, effects, space, zIndices } from "../styles/tokens.stylex";

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
  onCancel,
  pending = false,
  ...props
}: ConfirmationDialogProps) {
  return (
    <Dialog
      onClose={() => {
        if (!pending) onCancel();
      }}
      open={isOpen}
      {...stylex.props(styles.dialog)}
    >
      <DialogBackdrop {...stylex.props(styles.backdrop)} />
      <div {...stylex.props(styles.position)}>
        <DialogPanel {...stylex.props(styles.panel)}>
          {/* The panel unmounts when closed, so the typed value resets. */}
          <ConfirmationDialogForm
            {...props}
            onCancel={onCancel}
            pending={pending}
          />
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function ConfirmationDialogForm({
  confirmation,
  continueLabel = "Continue",
  error,
  message = "Are you sure you want to continue with this action?",
  onCancel,
  onContinue,
  pending,
  pendingLabel,
  title = "Warning",
}: Omit<ConfirmationDialogProps, "isOpen" | "pending"> & {
  pending: boolean;
}) {
  const inputId = useId();
  const [typed, setTyped] = useState("");

  const confirmed =
    !confirmation ||
    typed.trim().toLowerCase() === confirmation.value.trim().toLowerCase();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmed && !pending) onContinue();
  }

  return (
    <form onSubmit={submit}>
      <DialogTitle as="div">
        <SectionHeading>{title}</SectionHeading>
      </DialogTitle>
      <div {...stylex.props(foundationStyles.body, styles.message)}>
        {message}
      </div>
      {confirmation ? (
        <div {...stylex.props(styles.confirmation)}>
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
        </div>
      ) : null}
      {error ? (
        <div {...stylex.props(styles.error)}>
          <FlashMessage tone="error">{error}</FlashMessage>
        </div>
      ) : null}
      <div {...stylex.props(styles.actions)}>
        <Button disabled={pending} onClick={onCancel} variant="tonal">
          Cancel
        </Button>
        <Button
          disabled={!confirmed}
          loading={pending}
          loadingLabel={pendingLabel}
          type="submit"
          variant="danger"
        >
          {continueLabel}
        </Button>
      </div>
    </form>
  );
}

const styles = stylex.create({
  dialog: { position: "relative", zIndex: zIndices.dialog },
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgb(0 0 0 / 0.72)",
  },
  position: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: space.x4,
    overflowY: "auto",
  },
  panel: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "480px",
    padding: space.x6,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    backgroundColor: colors.ground,
    boxShadow: effects.overlayShadow,
  },
  message: {
    marginTop: space.x3,
    color: colors.inkMuted,
  },
  confirmation: {
    marginTop: space.x6,
  },
  error: {
    marginTop: space.x4,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: space.x2,
    marginTop: space.x6,
    flexWrap: "wrap",
  },
});
