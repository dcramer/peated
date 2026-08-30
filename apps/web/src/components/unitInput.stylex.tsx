import * as stylex from "@stylexjs/stylex";
import type { InputHTMLAttributes } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../styles/tokens.stylex";

export type UnitInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "style"
> & {
  invalid?: boolean;
  unit: string;
};

/** Keeps a numeric value and its fixed unit in one control. */
export function UnitInput({
  disabled = false,
  invalid = false,
  type = "number",
  unit,
  ...props
}: UnitInputProps) {
  return (
    <span
      data-disabled={disabled || undefined}
      {...stylex.props(
        styles.control,
        invalid && styles.invalid,
        disabled && styles.disabled,
      )}
    >
      <input
        {...props}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        type={type}
        {...stylex.props(styles.input)}
      />
      <span aria-hidden="true" {...stylex.props(styles.unit)}>
        {unit}
      </span>
    </span>
  );
}

const styles = stylex.create({
  control: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    height: controlMetrics.controlHeightLarge,
    alignItems: "center",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: {
      default: colors.fieldRule,
      ":hover": colors.inkMuted,
      ":focus-within": colors.accent,
    },
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.fieldBackground,
    boxShadow: {
      default: "none",
      ":focus-within": `inset 0 0 0 1px ${colors.accent}`,
    },
  },
  invalid: {
    borderColor: colors.critical,
    boxShadow: {
      default: effects.errorRing,
      ":focus-within": effects.errorRing,
    },
  },
  disabled: {
    opacity: 0.45,
  },
  input: {
    boxSizing: "border-box",
    width: "100%",
    minWidth: 0,
    height: "100%",
    paddingRight: space.x2,
    paddingLeft: "13px",
    borderWidth: 0,
    outline: "none",
    backgroundColor: "transparent",
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "16px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
    "::placeholder": {
      color: colors.inkMuted,
      opacity: 1,
    },
  },
  unit: {
    flexShrink: 0,
    paddingRight: "13px",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1,
  },
});
