import * as stylex from "@stylexjs/stylex";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, controlMetrics, effects } from "../styles/tokens.stylex";

export type ChipVariant = "neutral" | "tinted" | "solid";
export type ChipSize = "sm" | "md";

export type ChipProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "style" | "type"
> & {
  children: ReactNode;
  size?: ChipSize;
  variant?: ChipVariant;
};

/** A static label or interactive filter; small chips suit dense read-only previews. */
export function Chip({
  children,
  onClick,
  size = "md",
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
        {...stylex.props(
          foundationStyles.interactiveSmall,
          styles.chip,
          size === "sm" && styles.small,
          styles.interactive,
          size === "sm" && styles.smallInteractive,
          variants[variant],
        )}
      >
        {children}
      </button>
    );
  }

  return (
    <span
      data-variant={variant}
      {...stylex.props(
        foundationStyles.interactiveSmall,
        styles.chip,
        size === "sm" && styles.small,
        variants[variant],
      )}
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
        foundationStyles.metadata,
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
    fontWeight: 600,
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
  small: {
    minHeight: "24px",
    paddingTop: "2px",
    paddingRight: "8px",
    paddingBottom: "2px",
    paddingLeft: "8px",
  },
  smallInteractive: {
    minHeight: controlMetrics.controlHeightSmall,
  },
  neutral: {
    backgroundColor: "transparent",
    boxShadow: {
      default: `inset 0 0 0 1px ${colors.sectionRule}`,
      ":focus-visible": `inset 0 0 0 1px ${colors.sectionRule}`,
    },
    color: colors.inkMuted,
  },
  tinted: {
    backgroundColor: "transparent",
    boxShadow: {
      default: `inset 0 0 0 1px ${colors.accent}`,
      ":focus-visible": `inset 0 0 0 1px ${colors.accent}`,
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
    fontVariantNumeric: "tabular-nums",
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
