"use client";

import * as stylex from "@stylexjs/stylex";
import { ArrowRight } from "lucide-react";

import { foundationStyles } from "../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  space,
} from "../styles/tokens.stylex";

export type TastingFormMode = "tasting" | "review";

/** Starts a tasting or review before showing its form steps. */
export function TastingFormModeChoice({
  disabled,
  onChange,
}: {
  disabled: boolean;
  onChange: (value: TastingFormMode) => void;
}) {
  const choices = [
    {
      description: "Save this pour with notes and a rating.",
      label: "Log a tasting",
      value: "tasting",
    },
    {
      description: "Save your overall opinion and a score for this bottle.",
      label: "Write a review",
      value: "review",
    },
  ] as const;

  return (
    <div
      aria-label="Tasting or review"
      role="group"
      {...stylex.props(styles.choices)}
    >
      {choices.map((choice) => {
        return (
          <button
            disabled={disabled}
            key={choice.value}
            onClick={() => onChange(choice.value)}
            type="button"
            {...stylex.props(styles.choice, disabled && styles.disabledChoice)}
          >
            <span {...stylex.props(styles.choiceCopy)}>
              <strong {...stylex.props(foundationStyles.compactRowTitle)}>
                {choice.label}
              </strong>
              <span
                {...stylex.props(
                  foundationStyles.metadata,
                  styles.choiceDescription,
                )}
              >
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
  choiceCopy: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    gap: space.x1,
  },

  choiceDescription: {
    color: colors.inkMuted,
  },
  disabledChoice: { cursor: "not-allowed", opacity: 0.45 },
});
