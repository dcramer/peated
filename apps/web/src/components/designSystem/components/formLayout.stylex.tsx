import * as stylex from "@stylexjs/stylex";
import type { HTMLAttributes, ReactNode } from "react";

import { foundationStyles } from "../../../styles/foundations.stylex";
import { colors, fonts, space } from "../../../styles/tokens.stylex";

export function FormStack({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.stack)}>{children}</div>;
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

export function FormNotice({ children }: { children: ReactNode }) {
  return (
    <div role="status" {...stylex.props(styles.notice)}>
      {children}
    </div>
  );
}

const styles = stylex.create({
  stack: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x4,
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
});
