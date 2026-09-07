import type { TagCategory } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, controlMetrics } from "../../styles/tokens.stylex";
import {
  tastingCategoryOutlineStyles,
  tastingCategorySelectedOutlineStyles,
} from "./tastingCategoryStyles.stylex";

type TastingNoteButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "className" | "style"
> & {
  category: TagCategory;
  children: ReactNode;
  selected?: boolean;
};

/** Selects a tasting note while keeping its category visible as a colored border. */
export function TastingNoteButton({
  category,
  children,
  selected,
  type = "button",
  ...props
}: TastingNoteButtonProps) {
  return (
    <button
      {...props}
      aria-pressed={selected}
      type={type}
      {...stylex.props(
        foundationStyles.interactiveSmall,
        styles.button,
        tastingCategoryOutlineStyles[category],
        selected && styles.selected,
        selected && tastingCategorySelectedOutlineStyles[category],
      )}
    >
      {children}
    </button>
  );
}

const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

const styles = stylex.create({
  button: {
    boxSizing: "border-box",
    position: "relative",
    display: "inline-flex",
    height: controlMetrics.controlHeightSmall,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    borderRadius: controlMetrics.radiusSmall,
    paddingRight: "12px",
    paddingLeft: "12px",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
      ":active": colors.inset,
      ":focus-visible": colors.surface,
    },
    color: colors.ink,
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    opacity: {
      default: 1,
      ":hover": 0.86,
      ":active": 0.75,
      ":focus-visible": 0.86,
      ":disabled": 0.45,
    },
    outline: "none",
    transitionProperty: "background-color, color, opacity",
    transitionDuration: { default: "120ms", [REDUCED_MOTION]: "0ms" },
    whiteSpace: "nowrap",
    "::after": {
      position: "absolute",
      inset: "-2px",
      content: '""',
    },
  },
  selected: {
    backgroundColor: {
      default: colors.surface,
      ":hover": colors.inset,
      ":active": colors.inset,
      ":focus-visible": colors.surface,
    },
    color: colors.ink,
    fontWeight: 700,
  },
});
