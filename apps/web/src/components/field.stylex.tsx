import * as stylex from "@stylexjs/stylex";
import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { forwardRef } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../styles/tokens.stylex";

export type FieldProps = {
  children: ReactNode;
  error?: ReactNode;
  errorId?: string;
  hint?: ReactNode;
  htmlFor: string;
  label: ReactNode;
  optional?: boolean;
  required?: boolean;
};

export function Field({
  children,
  error,
  errorId,
  hint,
  htmlFor,
  label,
  optional = false,
  required = false,
}: FieldProps) {
  return (
    <div {...stylex.props(styles.field)}>
      <div {...stylex.props(styles.labelRow)}>
        <label
          htmlFor={htmlFor}
          {...stylex.props(foundationStyles.fieldLabel, styles.label)}
        >
          {label}
        </label>
        {required || optional ? (
          <span
            {...stylex.props(
              foundationStyles.microLabel,
              required ? styles.required : styles.optional,
            )}
          >
            {required ? "Required" : "Optional"}
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <ValidationMessage id={errorId}>{error}</ValidationMessage>
      ) : hint ? (
        <p {...stylex.props(foundationStyles.metadata, styles.hint)}>{hint}</p>
      ) : null}
    </div>
  );
}

export type FieldGroupProps = Omit<FieldProps, "htmlFor">;

export function FieldGroup({
  children,
  error,
  errorId,
  hint,
  label,
  optional = false,
  required = false,
}: FieldGroupProps) {
  return (
    <fieldset {...stylex.props(styles.field, styles.fieldset)}>
      <legend {...stylex.props(styles.legend)}>
        <span {...stylex.props(styles.labelRow)}>
          <span {...stylex.props(foundationStyles.fieldLabel, styles.label)}>
            {label}
          </span>
          {required || optional ? (
            <span
              {...stylex.props(
                foundationStyles.microLabel,
                required ? styles.required : styles.optional,
              )}
            >
              {required ? "Required" : "Optional"}
            </span>
          ) : null}
        </span>
      </legend>
      {children}
      {error ? (
        <ValidationMessage id={errorId}>{error}</ValidationMessage>
      ) : hint ? (
        <p {...stylex.props(foundationStyles.metadata, styles.hint)}>{hint}</p>
      ) : null}
    </fieldset>
  );
}

type InputFormat = "text" | "data";

export type TextInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "style"
> & {
  format?: InputFormat;
  invalid?: boolean;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ format = "text", invalid = false, ...props }, ref) {
    return (
      <input
        {...props}
        aria-invalid={invalid || undefined}
        data-format={format}
        ref={ref}
        {...stylex.props(
          styles.control,
          styles.input,
          format === "data" && styles.data,
          invalid && styles.invalid,
        )}
      />
    );
  },
);

export type TextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className" | "style"
> & {
  format?: InputFormat;
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ format = "text", invalid = false, ...props }, ref) {
    return (
      <textarea
        {...props}
        aria-invalid={invalid || undefined}
        data-format={format}
        ref={ref}
        {...stylex.props(
          styles.control,
          styles.textarea,
          format === "data" && styles.data,
          invalid && styles.invalid,
        )}
      />
    );
  },
);

export function ValidationMessage({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}) {
  return (
    <p
      id={id}
      role="alert"
      {...stylex.props(foundationStyles.metadata, styles.validation)}
    >
      {children}
    </p>
  );
}

const styles = stylex.create({
  field: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: "7px",
  },
  fieldset: {
    margin: 0,
    padding: 0,
    borderWidth: 0,
  },
  legend: {
    boxSizing: "border-box",
    width: "100%",
    margin: 0,
    marginBottom: space.x2,
    padding: 0,
  },
  labelRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "flex-start",
    columnGap: space.x2,
  },
  label: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  required: {
    color: colors.accentDeep,
    fontSize: "12px",
    fontStyle: "italic",
  },
  optional: {
    color: colors.inkMuted,
    fontSize: "12px",
    fontStyle: "italic",
  },
  control: {
    boxSizing: "border-box",
    width: "100%",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: {
      default: colors.fieldRule,
      ":hover": colors.inkMuted,
      ":focus": colors.accent,
    },
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: colors.fieldBackground,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "16px",
    lineHeight: 1.45,
    opacity: {
      default: 1,
      ":disabled": 0.45,
    },
    boxShadow: {
      default: "none",
      ":focus": `inset 0 0 0 1px ${colors.accent}`,
    },
    "::placeholder": {
      color: colors.inkMuted,
      opacity: 1,
    },
  },
  input: {
    height: controlMetrics.controlHeightLarge,
    paddingRight: "13px",
    paddingLeft: "13px",
  },
  textarea: {
    minHeight: "96px",
    paddingTop: "11px",
    paddingRight: "13px",
    paddingBottom: "11px",
    paddingLeft: "13px",
    resize: "vertical",
  },
  data: {
    fontFamily: fonts.data,
    fontVariantNumeric: "tabular-nums",
  },
  invalid: {
    borderColor: colors.critical,
    boxShadow: {
      default: effects.errorRing,
      ":focus-visible": effects.errorRing,
    },
  },
  hint: {
    margin: 0,
    color: colors.inkMuted,
    fontSize: "13px",
  },
  validation: {
    margin: 0,
    color: colors.critical,
    fontSize: "13px",
    fontWeight: 600,
  },
});
