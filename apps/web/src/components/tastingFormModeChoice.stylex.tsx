"use client";

import * as stylex from "@stylexjs/stylex";
import { ArrowRight } from "lucide-react";
import { useId } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, space } from "../styles/tokens.stylex";
import { Button } from "./button.stylex";

export type TastingFormMode = "tasting" | "review";

/** Starts a tasting or review before showing its form steps. */
export function TastingFormModeChoice({
  disabled,
  onChange,
}: {
  disabled: boolean;
  onChange: (value: TastingFormMode) => void;
}) {
  const id = useId();
  const choices = [
    {
      description: "Notes and a rating for this pour.",
      label: "Log a tasting",
      value: "tasting",
    },
    {
      description: "Your opinion of the bottle, with a score out of 100.",
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
      {choices.map((choice) => (
        <div key={choice.value} {...stylex.props(styles.choice)}>
          <Button
            aria-describedby={`${id}-${choice.value}`}
            disabled={disabled}
            fullWidth
            onClick={() => onChange(choice.value)}
            variant="tonal"
          >
            {choice.label}
            <ArrowRight aria-hidden="true" size={18} />
          </Button>
          <p
            id={`${id}-${choice.value}`}
            {...stylex.props(foundationStyles.metadata, styles.description)}
          >
            {choice.description}
          </p>
        </div>
      ))}
    </div>
  );
}

const styles = stylex.create({
  choices: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      "@media (max-width: 559px)": "minmax(0, 1fr)",
    },
    gap: space.x3,
  },
  choice: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: space.x2,
  },
  description: {
    margin: 0,
    color: colors.inkMuted,
  },
});
