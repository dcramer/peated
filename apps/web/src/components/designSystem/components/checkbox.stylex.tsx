import * as stylex from "@stylexjs/stylex";
import type { InputHTMLAttributes, ReactNode } from "react";

import { foundationStyles } from "../../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  space,
} from "../../../styles/tokens.stylex";

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "children" | "className" | "style" | "type"
> & {
  description?: ReactNode;
  label: ReactNode;
};

export function Checkbox({
  description,
  disabled = false,
  label,
  ...props
}: CheckboxProps) {
  return (
    <label {...stylex.props(styles.root, disabled && styles.disabled)}>
      <input
        {...props}
        disabled={disabled}
        type="checkbox"
        {...stylex.props(styles.input)}
      />
      <span {...stylex.props(styles.copy)}>
        <span {...stylex.props(foundationStyles.body)}>{label}</span>
        {description ? (
          <span
            {...stylex.props(foundationStyles.metadata, styles.description)}
          >
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

const styles = stylex.create({
  root: {
    display: "flex",
    alignItems: "flex-start",
    columnGap: space.x3,
    color: colors.ink,
    cursor: "pointer",
  },
  input: {
    boxSizing: "border-box",
    display: "block",
    width: "20px",
    height: "20px",
    flexShrink: 0,
    margin: 0,
    accentColor: colors.accent,
    appearance: "auto",
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    cursor: "inherit",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  copy: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x1,
  },
  description: {
    color: colors.inkMuted,
  },
  disabled: {
    cursor: "not-allowed",
    opacity: 0.45,
  },
});
