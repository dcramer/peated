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

export type OptionalFieldProps = {
  children: ReactNode;
  defaultOpen?: boolean;
  label: ReactNode;
  summary: ReactNode;
};

export function OptionalFieldList({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.optionalFieldList)}>{children}</div>;
}

/** Shows one optional value as a compact row until the user chooses to edit it. */
export function OptionalField({
  children,
  defaultOpen = false,
  label,
  summary,
}: OptionalFieldProps) {
  return (
    <details
      open={defaultOpen || undefined}
      {...stylex.props(styles.optionalField)}
    >
      <summary {...stylex.props(styles.optionalFieldSummary)}>
        <span {...stylex.props(styles.optionalFieldCopy)}>
          <span
            {...stylex.props(
              foundationStyles.fieldLabel,
              styles.optionalFieldLabel,
            )}
          >
            {label}
          </span>
          <span
            {...stylex.props(
              foundationStyles.metadata,
              styles.optionalFieldValue,
            )}
          >
            {summary}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          size={18}
          {...stylex.props(styles.optionalFieldIcon)}
        />
      </summary>
      <div {...stylex.props(styles.optionalFieldControl)}>{children}</div>
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
  optionalField: {
    boxSizing: "border-box",
    minWidth: 0,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  optionalFieldList: {
    minWidth: 0,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  optionalFieldSummary: {
    boxSizing: "border-box",
    display: "flex",
    minWidth: 0,
    minHeight: "56px",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x4,
    marginRight: `calc(-1 * ${space.x3})`,
    marginLeft: `calc(-1 * ${space.x3})`,
    paddingRight: space.x3,
    paddingLeft: space.x3,
    borderRadius: "2px",
    listStyle: "none",
    cursor: "pointer",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.inset,
    },
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
    outline: "none",
    "::-webkit-details-marker": { display: "none" },
  },
  optionalFieldCopy: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x1,
  },
  optionalFieldLabel: {
    color: colors.ink,
  },
  optionalFieldValue: {
    overflow: "hidden",
    color: colors.inkMuted,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  optionalFieldIcon: {
    flexShrink: 0,
    color: colors.inkMuted,
  },
  optionalFieldControl: {
    minWidth: 0,
    paddingTop: space.x2,
    paddingBottom: space.x6,
  },
});
