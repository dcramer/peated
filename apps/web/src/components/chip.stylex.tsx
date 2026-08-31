import * as stylex from "@stylexjs/stylex";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
} from "../styles/tokens.stylex";

export type ChipVariant = "neutral" | "tinted" | "solid";

export type ChipProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "style" | "type"
> & {
  children: ReactNode;
  variant?: ChipVariant;
};

export function Chip({
  children,
  onClick,
  variant = "neutral",
  ...props
}: ChipProps) {
  if (onClick) {
    return (
      <button
        {...props}
        data-variant={variant}
        onClick={onClick}
        type="button"
        {...stylex.props(styles.chip, styles.interactive, variants[variant])}
      >
        {children}
      </button>
    );
  }

  return (
    <span
      data-variant={variant}
      {...stylex.props(styles.chip, variants[variant])}
    >
      {children}
    </span>
  );
}

export function CountChip({
  count,
  tone = "accent",
}: {
  count: number;
  tone?: "accent" | "neutral";
}) {
  return (
    <span
      data-tone={tone}
      {...stylex.props(
        styles.count,
        tone === "accent" ? styles.countAccent : styles.countNeutral,
      )}
    >
      {count.toLocaleString("en-US")}
    </span>
  );
}

const styles = stylex.create({
  chip: {
    boxSizing: "border-box",
    display: "inline-flex",
    minHeight: "26px",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    borderRadius: controlMetrics.radiusSmall,
    paddingTop: "5px",
    paddingRight: "10px",
    paddingBottom: "5px",
    paddingLeft: "10px",
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: "nowrap",
  },
  interactive: {
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    opacity: {
      default: 1,
      ":hover": 0.82,
      ":disabled": 0.45,
    },
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  neutral: {
    backgroundColor: "transparent",
    boxShadow: {
      default: `inset 0 0 0 1px ${colors.sectionRule}`,
      ":focus-visible": effects.focusRing,
    },
    color: colors.inkMuted,
  },
  tinted: {
    backgroundColor: "transparent",
    boxShadow: {
      default: `inset 0 0 0 1px ${colors.accent}`,
      ":focus-visible": effects.focusRing,
    },
    color: colors.accentDeep,
  },
  solid: {
    backgroundColor: colors.accent,
    color: colors.ground,
  },
  count: {
    display: "inline-flex",
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: controlMetrics.radiusSmall,
    padding: 0,
    fontFamily: fonts.data,
    fontSize: "15px",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 400,
    lineHeight: 1,
  },
  countAccent: {
    backgroundColor: "transparent",
    color: colors.inkMuted,
  },
  countNeutral: {
    backgroundColor: "transparent",
    color: colors.inkMuted,
  },
});

const variants = {
  neutral: styles.neutral,
  tinted: styles.tinted,
  solid: styles.solid,
} satisfies Record<ChipVariant, stylex.StyleXStyles>;
