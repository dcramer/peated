"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { SectionHeading } from "./sectionHeading.stylex";

import { Button } from ".";
import { foundationStyles } from "../styles/foundations.stylex";
import { colors, effects, space, zIndices } from "../styles/tokens.stylex";

export default function ConfirmationDialog({
  continueLabel = "Continue",
  isOpen,
  message = "Are you sure you want to continue with this action?",
  onCancel,
  onContinue,
  title = "Warning",
}: {
  continueLabel?: string;
  isOpen: boolean;
  message?: ReactNode;
  onCancel: () => void;
  onContinue: () => void;
  title?: string;
}) {
  return (
    <Dialog onClose={onCancel} open={isOpen} {...stylex.props(styles.dialog)}>
      <DialogBackdrop {...stylex.props(styles.backdrop)} />
      <div {...stylex.props(styles.position)}>
        <DialogPanel {...stylex.props(styles.panel)}>
          <DialogTitle as="div">
            <SectionHeading>{title}</SectionHeading>
          </DialogTitle>
          <div {...stylex.props(foundationStyles.body, styles.message)}>
            {message}
          </div>
          <div {...stylex.props(styles.actions)}>
            <Button onClick={onCancel} variant="tonal">
              Cancel
            </Button>
            <Button onClick={onContinue} variant="danger">
              {continueLabel}
            </Button>
          </div>
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
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: space.x2,
    marginTop: space.x6,
    flexWrap: "wrap",
  },
});
