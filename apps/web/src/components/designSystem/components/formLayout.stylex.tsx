import * as stylex from "@stylexjs/stylex";
import { ChevronDown } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

import { foundationStyles } from "../../../styles/foundations.stylex";
import { colors, effects, fonts, space } from "../../../styles/tokens.stylex";

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
          <h2 {...stylex.props(foundationStyles.sectionHeading)}>{title}</h2>
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
            <span {...stylex.props(styles.stepLabel)}>{step}</span>
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
  },
  grid: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: {
      default: "repeat(2, minmax(0, 1fr))",
      "@media (max-width: 559px)": "1fr",
    },
    gap: space.x4,
  },
  section: {
    boxSizing: "border-box",
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x6,
    padding: { default: space.x6, "@media (max-width: 559px)": space.x4 },
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
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
    rowGap: space.x4,
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
    paddingTop: space.x4,
    paddingRight: space.x4,
    paddingBottom: space.x4,
    paddingLeft: space.x4,
    borderRadius: "3px",
    backgroundColor: colors.inset,
    "@media (max-width: 559px)": {
      flexDirection: "column",
      alignItems: "stretch",
      gap: space.x2,
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
    fontFamily: fonts.data,
    fontSize: "11px",
    letterSpacing: "0.06em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  completedStep: { color: colors.ink },
  currentStep: { color: colors.accentDeep, fontWeight: 500 },
  stepLabel: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  stepCount: {
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.3,
  },
  notice: {
    boxSizing: "border-box",
    padding: space.x4,
    borderLeftWidth: "3px",
    borderLeftStyle: "solid",
    borderLeftColor: colors.accent,
    backgroundColor: colors.accentTint,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.45,
  },
  details: {
    boxSizing: "border-box",
    minWidth: 0,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  summary: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.x4,
    padding: { default: space.x6, "@media (max-width: 559px)": space.x4 },
    listStyle: "none",
    cursor: "pointer",
    "::-webkit-details-marker": { display: "none" },
  },
  detailsIcon: { flexShrink: 0, color: colors.inkMuted },
  detailFields: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x4,
    paddingTop: 0,
    paddingRight: { default: space.x6, "@media (max-width: 559px)": space.x4 },
    paddingBottom: {
      default: space.x6,
      "@media (max-width: 559px)": space.x4,
    },
    paddingLeft: { default: space.x6, "@media (max-width: 559px)": space.x4 },
  },
});
