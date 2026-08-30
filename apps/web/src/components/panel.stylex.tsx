import * as stylex from "@stylexjs/stylex";
import type { HTMLAttributes, ReactNode } from "react";

import { colors, controlMetrics, fonts, space } from "../styles/tokens.stylex";

export type PanelProps = Omit<
  HTMLAttributes<HTMLElement>,
  "className" | "style" | "title"
> & {
  aside?: ReactNode;
  asideFormat?: "data" | "text";
  children: ReactNode;
  intro?: ReactNode;
  padding?: "lg" | "md" | "none";
  title?: ReactNode;
};

/** Adds one deliberate surface break to an otherwise flat page. */
export function Panel({
  aside,
  asideFormat = "text",
  children,
  intro,
  padding = "md",
  title,
  ...props
}: PanelProps) {
  return (
    <section {...props} {...stylex.props(styles.panel, paddingStyles[padding])}>
      {title || aside ? (
        <div {...stylex.props(styles.head)}>
          {title ? <h2 {...stylex.props(styles.title)}>{title}</h2> : <span />}
          {aside ? (
            <span
              {...stylex.props(
                styles.aside,
                asideFormat === "data" && styles.dataAside,
              )}
            >
              {aside}
            </span>
          ) : null}
        </div>
      ) : null}
      {intro ? <p {...stylex.props(styles.intro)}>{intro}</p> : null}
      <div {...stylex.props(styles.body)}>{children}</div>
    </section>
  );
}

const styles = stylex.create({
  panel: {
    boxSizing: "border-box",
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  paddingMedium: {
    paddingTop: space.x4,
    paddingRight: "18px",
    paddingBottom: "6px",
    paddingLeft: "18px",
  },
  paddingLarge: {
    paddingTop: "20px",
    paddingRight: "22px",
    paddingBottom: "10px",
    paddingLeft: "22px",
  },
  paddingNone: { padding: 0 },
  head: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    columnGap: space.x3,
    rowGap: space.x1,
    paddingBottom: "11px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.sectionRule,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontFamily: fonts.display,
    fontSize: "16px",
    fontWeight: 700,
    letterSpacing: "-0.022em",
    lineHeight: 1.2,
  },
  aside: {
    flexShrink: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.35,
  },
  dataAside: {
    fontFamily: fonts.data,
    fontSize: "12px",
    fontVariantNumeric: "tabular-nums",
  },
  intro: {
    maxWidth: "34ch",
    marginTop: "9px",
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  body: { marginTop: "2px" },
});

const paddingStyles = {
  lg: styles.paddingLarge,
  md: styles.paddingMedium,
  none: styles.paddingNone,
} satisfies Record<NonNullable<PanelProps["padding"]>, stylex.StyleXStyles>;
