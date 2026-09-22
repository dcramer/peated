"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import * as stylex from "@stylexjs/stylex";
import type { FormEvent, ReactNode } from "react";

import {
  Button,
  type ButtonVariant,
} from "@peated/web/components/button.stylex";
import { FlashMessage } from "@peated/web/components/feedback.stylex";
import { foundationStyles } from "../styles/foundations.stylex";
import { colors, effects, space, zIndices } from "../styles/tokens.stylex";
import { SectionHeading } from "./sectionHeading.stylex";

export type FormDialogProps = {
  children?: ReactNode;
  /** A failure from the last attempt. The dialog stays open so they can retry. */
  error?: ReactNode;
  isOpen: boolean;
  message?: ReactNode;
  onCancel: () => void;
  onSubmit: () => void;
  /** True while the action runs. Submit shows progress and Cancel waits. */
  pending?: boolean;
  pendingLabel?: string;
  /** Keeps Submit disabled until the form is ready, such as a typed confirmation. */
  submitDisabled?: boolean;
  submitLabel: string;
  submitVariant?: ButtonVariant;
  title: string;
};

/** A small dialog that collects a few fields before an action. */
export function FormDialog({
  children,
  error,
  isOpen,
  message,
  onCancel,
  onSubmit,
  pending = false,
  pendingLabel,
  submitDisabled = false,
  submitLabel,
  submitVariant = "accent",
  title,
}: FormDialogProps) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending && !submitDisabled) onSubmit();
  }

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
          <form onSubmit={submit}>
            <DialogTitle as="div">
              <SectionHeading>{title}</SectionHeading>
            </DialogTitle>
            {message ? (
              <div {...stylex.props(foundationStyles.body, styles.message)}>
                {message}
              </div>
            ) : null}
            {children ? (
              <div {...stylex.props(styles.fields)}>{children}</div>
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
                disabled={submitDisabled}
                loading={pending}
                loadingLabel={pendingLabel}
                type="submit"
                variant={submitVariant}
              >
                {submitLabel}
              </Button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
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
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: space.x4,
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
