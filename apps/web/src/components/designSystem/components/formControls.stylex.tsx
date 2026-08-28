import * as stylex from "@stylexjs/stylex";
import { ChevronDown } from "lucide-react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

import { foundationStyles } from "../../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";

export type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "className" | "style"
> & {
  invalid?: boolean;
};

export function Select({
  children,
  disabled = false,
  invalid = false,
  ...props
}: SelectProps) {
  return (
    <span {...stylex.props(styles.selectWrapper)}>
      <select
        {...props}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        {...stylex.props(
          styles.select,
          invalid && styles.invalid,
          disabled && styles.disabled,
        )}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={15}
        strokeWidth={1.75}
        {...stylex.props(styles.selectIcon, disabled && styles.disabled)}
      />
    </span>
  );
}

export type SegmentedControlOption<Value extends string = string> = {
  disabled?: boolean;
  label: ReactNode;
  value: Value;
};

export type SegmentedControlProps<Value extends string = string> = {
  disabled?: boolean;
  id: string;
  label: string;
  name: string;
  onChange: (value: Value) => void;
  options: readonly SegmentedControlOption<Value>[];
  value: Value;
};

export function SegmentedControl<Value extends string>({
  disabled = false,
  id,
  label,
  name,
  onChange,
  options,
  value,
}: SegmentedControlProps<Value>) {
  return (
    <div
      aria-label={label}
      role="radiogroup"
      {...stylex.props(styles.segmented)}
    >
      {options.map((option) => {
        const checked = option.value === value;
        const optionDisabled = disabled || option.disabled;

        return (
          <label
            key={option.value}
            {...stylex.props(
              styles.segment,
              checked && styles.segmentChecked,
              optionDisabled && styles.disabled,
            )}
          >
            <input
              checked={checked}
              disabled={optionDisabled}
              id={`${id}-${option.value}`}
              name={name}
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
              {...stylex.props(styles.visuallyHiddenInput)}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export type ChoiceListOption<Value extends string = string> = {
  description?: ReactNode;
  disabled?: boolean;
  label: ReactNode;
  value: Value;
};

export type ChoiceListProps<Value extends string = string> = {
  disabled?: boolean;
  id: string;
  label: string;
  name: string;
  onChange: (value: Value) => void;
  options: readonly ChoiceListOption<Value>[];
  value: Value;
};

/** Presents mutually exclusive choices that need more space than tabs. */
export function ChoiceList<Value extends string>({
  disabled = false,
  id,
  label,
  name,
  onChange,
  options,
  value,
}: ChoiceListProps<Value>) {
  return (
    <div aria-label={label} role="radiogroup" {...stylex.props(styles.choices)}>
      {options.map((option) => {
        const checked = option.value === value;
        const optionDisabled = disabled || option.disabled;
        return (
          <label
            key={option.value}
            {...stylex.props(
              styles.choice,
              checked && styles.choiceChecked,
              optionDisabled && styles.disabled,
            )}
          >
            <input
              checked={checked}
              disabled={optionDisabled}
              id={`${id}-${option.value}`}
              name={name}
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
              {...stylex.props(styles.visuallyHiddenInput)}
            />
            <span aria-hidden="true" {...stylex.props(styles.radioMark)}>
              {checked ? <span {...stylex.props(styles.radioDot)} /> : null}
            </span>
            <span {...stylex.props(styles.choiceCopy)}>
              <span {...stylex.props(foundationStyles.interactive)}>
                {option.label}
              </span>
              {option.description ? (
                <span
                  {...stylex.props(
                    foundationStyles.metadata,
                    styles.description,
                  )}
                >
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export type SwitchProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | "checked"
  | "children"
  | "className"
  | "defaultChecked"
  | "onChange"
  | "style"
  | "type"
> & {
  checked: boolean;
  description?: ReactNode;
  label: ReactNode;
  onCheckedChange: (checked: boolean) => void;
};

export function Switch({
  checked,
  description,
  disabled = false,
  label,
  onCheckedChange,
  ...props
}: SwitchProps) {
  return (
    <label {...stylex.props(styles.switchRoot, disabled && styles.disabled)}>
      <span {...stylex.props(styles.switchControl)}>
        <input
          {...props}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.currentTarget.checked)}
          type="checkbox"
          {...stylex.props(styles.visuallyHiddenInput)}
        />
        <span
          aria-hidden="true"
          {...stylex.props(styles.switchTrack, checked && styles.switchTrackOn)}
        >
          <span
            {...stylex.props(
              styles.switchThumb,
              checked && styles.switchThumbOn,
            )}
          />
        </span>
      </span>
      <span {...stylex.props(styles.switchCopy)}>
        <span {...stylex.props(foundationStyles.interactive)}>{label}</span>
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
  choices: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x2,
  },
  choice: {
    position: "relative",
    boxSizing: "border-box",
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    gap: space.x3,
    padding: space.x4,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    borderRadius: controlMetrics.radius,
    backgroundColor: { default: colors.inset, ":hover": colors.surface },
    color: colors.ink,
    cursor: "pointer",
    boxShadow: { default: "none", ":focus-within": effects.focusRing },
  },
  choiceChecked: {
    borderColor: colors.accentDeep,
    backgroundColor: colors.accentTint,
  },
  choiceCopy: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    rowGap: space.x1,
  },
  radioMark: {
    boxSizing: "border-box",
    display: "flex",
    width: "18px",
    height: "18px",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "1px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.inkMuted,
    borderRadius: "50%",
  },
  radioDot: {
    display: "block",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: colors.accentDeep,
  },
  selectWrapper: {
    position: "relative",
    display: "block",
    width: "100%",
  },
  select: {
    boxSizing: "border-box",
    width: "100%",
    height: controlMetrics.controlHeight,
    appearance: "none",
    paddingRight: "38px",
    paddingLeft: "14px",
    borderWidth: 0,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: colors.inset,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.45,
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  selectIcon: {
    position: "absolute",
    top: "13px",
    right: "13px",
    color: colors.inkMuted,
    pointerEvents: "none",
  },
  invalid: {
    boxShadow: {
      default: effects.errorRing,
      ":focus-visible": effects.errorRing,
    },
  },
  segmented: {
    display: "flex",
    width: "100%",
    columnGap: space.x1,
  },
  segment: {
    position: "relative",
    boxSizing: "border-box",
    display: "flex",
    minWidth: 0,
    height: controlMetrics.controlHeight,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: space.x3,
    paddingLeft: space.x3,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1,
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-within": effects.focusRing,
    },
    transitionProperty: "background-color, color, opacity",
    transitionDuration: "120ms",
  },
  segmentChecked: {
    backgroundColor: colors.accent,
    color: colors.ground,
  },
  visuallyHiddenInput: {
    position: "absolute",
    width: "1px",
    height: "1px",
    overflow: "hidden",
    opacity: 0,
    pointerEvents: "none",
  },
  switchRoot: {
    position: "relative",
    display: "inline-flex",
    alignItems: "flex-start",
    columnGap: space.x3,
    color: colors.ink,
    cursor: "pointer",
  },
  switchControl: {
    position: "relative",
    display: "inline-flex",
    flexShrink: 0,
    borderRadius: controlMetrics.radius,
    boxShadow: {
      default: "none",
      ":focus-within": effects.focusRing,
    },
  },
  switchTrack: {
    boxSizing: "border-box",
    position: "relative",
    width: "42px",
    height: "24px",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
    transitionProperty: "background-color",
    transitionDuration: "120ms",
  },
  switchTrackOn: {
    backgroundColor: colors.accent,
  },
  switchThumb: {
    position: "absolute",
    top: "3px",
    left: "3px",
    width: "18px",
    height: "18px",
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.ground,
    transform: "translateX(0)",
    transitionProperty: "transform",
    transitionDuration: "120ms",
  },
  switchThumbOn: {
    transform: "translateX(18px)",
  },
  switchCopy: {
    display: "flex",
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
