"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import * as stylex from "@stylexjs/stylex";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { foundationStyles } from "../styles/foundations.stylex";
import { colors, effects, space, zIndices } from "../styles/tokens.stylex";
import { IconButton } from "./button.stylex";

export type SlideoutProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  navigation?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Shows contextual details without leaving the current page. The header and optional
 * footer stay visible while the body scrolls. Uses the full screen on small devices.
 * Owns focus trapping, focus return, scroll locking, Escape, and outside dismissal.
 * Keep data loading and navigation in the caller; use a confirmation dialog for decisions.
 */
export function Slideout({
  open,
  onClose,
  title,
  navigation,
  children,
  footer,
}: SlideoutProps) {
  return (
    <Dialog open={open} onClose={onClose} {...stylex.props(styles.dialog)}>
      <DialogBackdrop transition {...stylex.props(styles.backdrop)} />
      <div {...stylex.props(styles.position)}>
        <DialogPanel transition {...stylex.props(styles.panel)}>
          <header {...stylex.props(styles.header)}>
            <div {...stylex.props(styles.heading)}>
              {navigation ? (
                <div {...stylex.props(styles.navigation)}>{navigation}</div>
              ) : null}
              <DialogTitle
                {...stylex.props(foundationStyles.sectionHeading, styles.title)}
              >
                {title}
              </DialogTitle>
            </div>
            <IconButton
              data-autofocus
              icon={<X size={20} />}
              label="Close panel"
              onClick={onClose}
              size="lg"
              variant="text"
            />
          </header>
          <div {...stylex.props(foundationStyles.body, styles.body)}>
            {children}
          </div>
          {footer ? (
            <footer {...stylex.props(styles.footer)}>{footer}</footer>
          ) : null}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";
const MOBILE = "@media (max-width: 559px)";
const styles = stylex.create({
  dialog: { position: "relative", zIndex: zIndices.dialog },
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgb(0 0 0 / 0.4)",
    opacity: { default: 1, ":is([data-closed])": 0 },
    transitionProperty: "opacity",
    transitionDuration: { default: "240ms", [REDUCED_MOTION]: "0ms" },
  },
  position: {
    position: "fixed",
    inset: 0,
    display: "flex",
    justifyContent: "flex-end",
  },
  panel: {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    maxWidth: { default: "520px", [MOBILE]: "100%" },
    height: "100%",
    minWidth: 0,
    backgroundColor: colors.ground,
    color: colors.ink,
    boxShadow: effects.overlayShadow,
    transform: {
      default: "translateX(0)",
      ":is([data-closed])": "translateX(100%)",
    },
    transitionProperty: "transform",
    transitionTimingFunction: "ease-out",
    transitionDuration: { default: "240ms", [REDUCED_MOTION]: "0ms" },
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.x4,
    padding: space.x6,
    flexShrink: 0,
    borderBottom: `1px solid ${colors.hairline}`,
  },
  heading: { minWidth: 0 },
  navigation: {
    marginBottom: space.x2,
  },
  title: {
    margin: 0,
    overflowWrap: "anywhere",
  },
  body: {
    minHeight: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
    padding: space.x6,
    flex: 1,
    paddingBottom: `max(${space.x6}, env(safe-area-inset-bottom))`,
  },
  footer: {
    flexShrink: 0,
    padding: space.x6,
    paddingBottom: `max(${space.x6}, env(safe-area-inset-bottom))`,
    borderTop: `1px solid ${colors.hairline}`,
  },
});
