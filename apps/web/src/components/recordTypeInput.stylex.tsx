"use client";

import * as stylex from "@stylexjs/stylex";
import { ArrowRight } from "lucide-react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../styles/tokens.stylex";

export type RecordType = "tasting" | "review";

export function RecordTypeInput({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (value: RecordType) => void;
  value: RecordType | null;
}) {
  const choices = [
    {
      description:
        "Record this pour with a rating, tasting notes, color, and details.",
      label: "Log a tasting",
      value: "tasting",
    },
    {
      description:
        "Give this bottle one overall score and a considered review.",
      label: "Write a review",
      value: "review",
    },
  ] as const;

  return (
    <div
      aria-label="Record type"
      role="group"
      {...stylex.props(styles.choices)}
    >
      {choices.map((choice) => {
        const checked = choice.value === value;
        return (
          <button
            aria-pressed={checked || undefined}
            disabled={disabled}
            key={choice.value}
            onClick={() => onChange(choice.value)}
            type="button"
            {...stylex.props(
              styles.choice,
              checked && styles.selectedChoice,
              disabled && styles.disabledChoice,
            )}
          >
            <span {...stylex.props(styles.choiceCopy)}>
              <strong {...stylex.props(styles.choiceLabel)}>
                {choice.label}
              </strong>
              <span {...stylex.props(styles.choiceDescription)}>
                {choice.description}
              </span>
            </span>
            <ArrowRight aria-hidden="true" size={19} strokeWidth={1.8} />
          </button>
        );
      })}
    </div>
  );
}

const styles = stylex.create({
  choices: {
    display: "grid",
    width: "100%",
    minWidth: 0,
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      "@media (max-width: 559px)": "minmax(0, 1fr)",
    },
    gap: space.x3,
  },
  choice: {
    boxSizing: "border-box",
    display: "flex",
    minWidth: 0,
    minHeight: "112px",
    alignItems: "center",
    gap: space.x4,
    padding: space.x4,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: {
      default: colors.fieldRule,
      ":hover": colors.inkMuted,
    },
    borderRadius: controlMetrics.radius,
    backgroundColor: {
      default: colors.fieldBackground,
      ":hover": colors.surface,
    },
    color: colors.ink,
    textAlign: "left",
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  selectedChoice: {
    borderColor: colors.accent,
    boxShadow: {
      default: `inset 0 0 0 1px ${colors.accent}`,
      ":focus-visible": effects.focusRing,
    },
  },
  choiceCopy: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    gap: space.x1,
  },
  choiceLabel: {
    fontFamily: fonts.display,
    fontSize: "16px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  choiceDescription: {
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
  },
  disabledChoice: { cursor: "not-allowed", opacity: 0.45 },
});
