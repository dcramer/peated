import * as stylex from "@stylexjs/stylex";
import { ChevronDown } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import { colors, effects, fonts, space } from "../styles/tokens.stylex";

export function FormStack({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.stack)}>{children}</div>;
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.grid)}>{children}</div>;
}

export type FormSectionProps = Omit<
  HTMLAttributes<HTMLElement>,
  "className" | "style" | "title"
> & {
  action?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  title: ReactNode;
};

/** Groups one set of related fields without owning form state or submission. */
export function FormSection({
  action,
  children,
  description,
  title,
  ...props
}: FormSectionProps) {
  return (
    <section {...props} {...stylex.props(styles.section)}>
      <div {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.copy)}>
          <h2
            {...stylex.props(
              foundationStyles.sectionHeading,
              styles.numberedHeading,
            )}
          >
            {title}
          </h2>
          {description ? (
            <div {...stylex.props(foundationStyles.body, styles.description)}>
              {description}
            </div>
          ) : null}
        </div>
        {action ? (
          <div {...stylex.props(styles.headerAction)}>{action}</div>
        ) : null}
      </div>
      <div {...stylex.props(styles.fields)}>{children}</div>
    </section>
  );
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.actions)}>{children}</div>;
}

export type FormStepsProps = {
  currentStep: number;
  steps: readonly string[];
};

/** Shows the full sequence for a form that moves through a few clear steps. */
export function FormSteps({ currentStep, steps }: FormStepsProps) {
  return (
    <nav aria-label="Form progress" {...stylex.props(styles.steps)}>
      <ol {...stylex.props(styles.stepList)}>
        {steps.map((step, index) => (
          <li
            aria-current={index === currentStep ? "step" : undefined}
            key={step}
            {...stylex.props(
              styles.step,
              index < currentStep && styles.completedStep,
              index === currentStep && styles.currentStep,
            )}
          >
            <span aria-hidden="true">{index + 1}</span>
            <span title={step} {...stylex.props(styles.stepLabel)}>
              {step}
            </span>
          </li>
        ))}
      </ol>
      <span {...stylex.props(styles.stepCount)}>
        Step {currentStep + 1} of {steps.length}
      </span>
    </nav>
  );
}

export type FormNoticeProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "className" | "style"
> & {
  children: ReactNode;
};

export function FormNotice({
  children,
  role = "status",
  ...props
}: FormNoticeProps) {
  return (
    <div {...props} role={role} {...stylex.props(styles.notice)}>
      {children}
    </div>
  );
}

export type FormDetailsProps = {
  children: ReactNode;
  defaultOpen?: boolean;
  description?: ReactNode;
  title: ReactNode;
};

/** Keeps optional form fields available without making the primary form dense. */
export function FormDetails({
  children,
  defaultOpen = false,
  description,
  title,
}: FormDetailsProps) {
  return (
    <details open={defaultOpen || undefined} {...stylex.props(styles.details)}>
      <summary {...stylex.props(styles.summary)}>
        <span {...stylex.props(styles.copy)}>
          <span {...stylex.props(foundationStyles.sectionHeading)}>
            {title}
          </span>
          {description ? (
            <span {...stylex.props(foundationStyles.body, styles.description)}>
              {description}
            </span>
          ) : null}
        </span>
        <ChevronDown
          aria-hidden="true"
          size={18}
          {...stylex.props(styles.detailsIcon)}
        />
      </summary>
      <div {...stylex.props(styles.detailFields)}>{children}</div>
    </details>
  );
}

const styles = stylex.create({
  stack: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x4,
    counterReset: "form-section",
  },
  grid: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      "@media (max-width: 559px)": "1fr",
    },
    gap: space.x6,
  },
  section: {
    boxSizing: "border-box",
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x6,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: space.x8,
    paddingLeft: 0,
    backgroundColor: "transparent",
    counterIncrement: "form-section",
  },
  header: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    justifyContent: "space-between",
    columnGap: space.x4,
  },
  copy: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x2,
  },
  numberedHeading: {
    "::before": {
      content: "counter(form-section, decimal-leading-zero)",
      marginRight: space.x3,
      color: colors.accent,
      fontVariantNumeric: "tabular-nums",
    },
  },
  description: {
    maxWidth: "62ch",
    color: colors.inkMuted,
  },
  headerAction: {
    flexShrink: 0,
  },
  fields: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x6,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: space.x2,
    flexWrap: "wrap",
  },
  steps: {
    boxSizing: "border-box",
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x4,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: space.x3,
    paddingLeft: 0,
    backgroundColor: "transparent",
    "@media (max-width: 559px)": {
      gap: space.x3,
    },
  },
  stepList: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    gap: space.x4,
    margin: 0,
    padding: 0,
    listStyle: "none",
    "@media (max-width: 559px)": { gap: space.x3 },
  },
  step: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    gap: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    fontWeight: 600,
    letterSpacing: 0,
    lineHeight: 1.3,
  },
  completedStep: { color: colors.ink },
  currentStep: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  stepLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  stepCount: {
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.3,
  },
  notice: {
    boxSizing: "border-box",
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "15px",
    lineHeight: 1.55,
  },
  details: {
    boxSizing: "border-box",
    minWidth: 0,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    backgroundColor: "transparent",
  },
  summary: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.x4,
    paddingTop: space.x4,
    paddingRight: 0,
    paddingBottom: space.x4,
    paddingLeft: 0,
    listStyle: "none",
    cursor: "pointer",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
    "::-webkit-details-marker": { display: "none" },
  },
  detailsIcon: { flexShrink: 0, color: colors.inkMuted },
  detailFields: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x4,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: {
      default: space.x6,
      "@media (max-width: 559px)": space.x4,
    },
    paddingLeft: 0,
  },
});
