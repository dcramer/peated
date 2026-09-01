"use client";

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import * as stylex from "@stylexjs/stylex";
import { ExternalLink, Maximize2, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
  controlMetrics,
  effects,
  fonts,
  space,
  zIndices,
} from "../styles/tokens.stylex";

export type ImageViewerProps = {
  alt: string;
  caption?: ReactNode;
  children: ReactNode;
  fill?: boolean;
  label: string;
  src: string;
};

/** Opens a content image in an accessible, viewport-sized dialog. */
export function ImageViewer({
  alt,
  caption,
  children,
  fill = false,
  label,
  src,
}: ImageViewerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label={`View ${label} at full size`}
        onClick={() => setOpen(true)}
        type="button"
        {...stylex.props(styles.trigger, fill && styles.fillTrigger)}
      >
        {children}
        <span aria-hidden="true" {...stylex.props(styles.expandCue)}>
          <Maximize2 size={15} strokeWidth={1.75} />
        </span>
      </button>
      <Dialog onClose={setOpen} open={open} {...stylex.props(styles.dialog)}>
        <DialogBackdrop {...stylex.props(styles.backdrop)} />
        <div {...stylex.props(styles.position)}>
          <DialogPanel {...stylex.props(styles.panel)}>
            <div {...stylex.props(styles.imageStage)}>
              <img alt={alt} src={src} {...stylex.props(styles.fullImage)} />
            </div>
            <div {...stylex.props(styles.footer)}>
              <DialogTitle {...stylex.props(styles.title)}>
                {caption ?? label}
              </DialogTitle>
              <a
                href={src}
                rel="noreferrer"
                target="_blank"
                {...stylex.props(styles.originalLink)}
              >
                Open original
                <ExternalLink aria-hidden="true" size={14} strokeWidth={1.75} />
              </a>
            </div>
            <button
              aria-label="Close image viewer"
              onClick={() => setOpen(false)}
              type="button"
              {...stylex.props(styles.close)}
            >
              <X aria-hidden="true" size={20} strokeWidth={1.75} />
            </button>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  );
}

const styles = stylex.create({
  trigger: {
    boxSizing: "border-box",
    position: "relative",
    display: "grid",
    width: "100%",
    overflow: "hidden",
    padding: 0,
    borderWidth: 0,
    borderRadius: "inherit",
    outline: "none",
    backgroundColor: "transparent",
    color: "inherit",
    font: "inherit",
    cursor: "zoom-in",
    placeItems: "center",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  fillTrigger: {
    height: "100%",
    gridTemplateColumns: "minmax(0, 1fr)",
    gridTemplateRows: "minmax(0, 1fr)",
  },
  expandCue: {
    position: "absolute",
    right: space.x1,
    bottom: space.x1,
    display: "grid",
    width: "28px",
    height: "28px",
    placeItems: "center",
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: "rgb(16 18 16 / 0.78)",
    color: "white",
    pointerEvents: "none",
  },
  dialog: {
    position: "relative",
    zIndex: zIndices.fullscreen,
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgb(0 0 0 / 0.88)",
  },
  position: {
    boxSizing: "border-box",
    position: "fixed",
    inset: 0,
    display: "grid",
    overflow: "auto",
    paddingTop: `max(${space.x6}, env(safe-area-inset-top))`,
    paddingRight: `max(${space.x6}, env(safe-area-inset-right))`,
    paddingBottom: `max(${space.x6}, env(safe-area-inset-bottom))`,
    paddingLeft: `max(${space.x6}, env(safe-area-inset-left))`,
    "@media (max-width: 639px)": {
      paddingTop: `max(${space.x3}, env(safe-area-inset-top))`,
      paddingRight: `max(${space.x3}, env(safe-area-inset-right))`,
      paddingBottom: `max(${space.x3}, env(safe-area-inset-bottom))`,
      paddingLeft: `max(${space.x3}, env(safe-area-inset-left))`,
    },
    placeItems: "center",
    pointerEvents: "none",
  },
  panel: {
    position: "relative",
    display: "flex",
    width: "fit-content",
    maxWidth: "calc(100vw - 48px)",
    maxHeight: "calc(100dvh - 48px)",
    flexDirection: "column",
    outline: "none",
    backgroundColor: "rgb(16 18 16 / 0.96)",
    boxShadow: "0 18px 40px rgb(0 0 0 / 0.55)",
    pointerEvents: "auto",
    "@media (max-width: 639px)": {
      maxWidth: "calc(100vw - 24px)",
      maxHeight: "calc(100dvh - 24px)",
    },
  },
  imageStage: {
    display: "grid",
    minWidth: 0,
    minHeight: 0,
    overflow: "auto",
    placeItems: "center",
    backgroundColor: "white",
  },
  fullImage: {
    display: "block",
    width: "auto",
    maxWidth: "100%",
    height: "auto",
    maxHeight: "calc(100dvh - 120px)",
    objectFit: "contain",
    "@media (max-width: 639px)": {
      maxHeight: "calc(100dvh - 96px)",
    },
  },
  footer: {
    boxSizing: "border-box",
    display: "flex",
    minHeight: "56px",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x4,
    paddingTop: space.x3,
    paddingRight: space.x4,
    paddingBottom: space.x3,
    paddingLeft: space.x4,
  },
  title: {
    minWidth: 0,
    flex: 1,
    overflow: "hidden",
    margin: 0,
    color: "white",
    fontFamily: fonts.reading,
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.35,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  originalLink: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    gap: space.x1,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: "white",
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.2,
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
    },
    boxShadow: {
      default: "none",
      ":focus-visible": "none",
    },
  },
  close: {
    position: "absolute",
    top: space.x2,
    right: space.x2,
    display: "grid",
    width: "40px",
    height: "40px",
    padding: 0,
    placeItems: "center",
    borderWidth: 0,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: {
      default: "rgb(16 18 16 / 0.82)",
      ":hover": "rgb(16 18 16 / 0.96)",
    },
    color: "white",
    cursor: "pointer",
    boxShadow: {
      default: "0 0 0 1px rgb(255 255 255 / 0.24)",
      ":focus-visible": "0 0 0 1px rgb(255 255 255 / 0.24)",
    },
  },
});
