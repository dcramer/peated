import * as stylex from "@stylexjs/stylex";

import { colors, fonts, space } from "../../../styles/tokens.stylex";

export type FormStep = {
  label: string;
};

export type FormStepsProps = {
  current: number;
  steps: readonly [FormStep, FormStep, ...FormStep[]];
};

/** States progress through a fixed form without turning steps into navigation. */
export function FormSteps({ current, steps }: FormStepsProps) {
  const activeStep = Math.min(steps.length - 1, Math.max(0, current));

  return (
    <div {...stylex.props(styles.root)}>
      <ol aria-label="Form progress" {...stylex.props(styles.steps)}>
        {steps.map((step, index) => (
          <li
            aria-current={index === activeStep ? "step" : undefined}
            data-state={
              index < activeStep
                ? "complete"
                : index === activeStep
                  ? "current"
                  : "upcoming"
            }
            key={step.label}
            {...stylex.props(
              styles.step,
              index <= activeStep && styles.reachedStep,
            )}
          >
            <span {...stylex.props(styles.number)}>{index + 1}</span>
            <span {...stylex.props(styles.label)}>{step.label}</span>
          </li>
        ))}
      </ol>
      <p aria-live="polite" {...stylex.props(styles.status)}>
        Step {activeStep + 1} of {steps.length}
      </p>
    </div>
  );
}

const styles = stylex.create({
  root: {
    width: "100%",
  },
  steps: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
    gap: "2px",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  step: {
    display: "flex",
    minWidth: 0,
    minHeight: "40px",
    alignItems: "center",
    gap: space.x2,
    paddingRight: space.x3,
    paddingLeft: space.x3,
    borderTopWidth: "3px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    color: colors.inkMuted,
  },
  reachedStep: {
    borderTopColor: colors.accent,
    color: colors.ink,
  },
  number: {
    flexShrink: 0,
    color: colors.accentDeep,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1,
  },
  label: {
    minWidth: 0,
    overflow: "hidden",
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.2,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  status: {
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.3,
    textAlign: "right",
  },
});
