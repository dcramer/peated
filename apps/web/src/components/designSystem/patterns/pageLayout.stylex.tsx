import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { foundationStyles } from "../../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import { SectionHeading, SkipLink } from "../components";

const NARROW = "@media (max-width: 759px)";
const MOBILE = "@media (max-width: 559px)";

export function PageFrame({
  children,
  footer,
  header,
}: {
  children: ReactNode;
  footer?: ReactNode;
  header: ReactNode;
}) {
  return (
    <div {...stylex.props(foundationStyles.document, styles.document)}>
      <SkipLink href="#main-content">Skip to content</SkipLink>
      {header}
      <main id="main-content" {...stylex.props(styles.page)}>
        {children}
      </main>
      {footer ? <div {...stylex.props(styles.footer)}>{footer}</div> : null}
    </div>
  );
}

export function PageColumns({
  children,
  rail,
  railBehavior = "hide",
}: {
  children: ReactNode;
  rail?: ReactNode;
  railBehavior?: "hide" | "stack";
}) {
  return (
    <div {...stylex.props(styles.columns, !rail && styles.singleColumn)}>
      <div {...stylex.props(styles.mainColumn)}>{children}</div>
      {rail ? (
        <aside
          {...stylex.props(
            styles.rail,
            railBehavior === "stack" && styles.stackedRail,
          )}
        >
          {rail}
        </aside>
      ) : null}
    </div>
  );
}

export function PageHeader({
  actions,
  description,
  eyebrow,
  identity,
  menu,
  parent,
  title,
}: {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  identity?: ReactNode;
  menu?: ReactNode;
  parent?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header {...stylex.props(styles.pageHeader)}>
      {identity}
      <div {...stylex.props(styles.pageHeaderBody)}>
        <div {...stylex.props(styles.pageHeaderCopy)}>
          {eyebrow ? (
            <div {...stylex.props(styles.eyebrow)}>{eyebrow}</div>
          ) : null}
          {parent ? <div {...stylex.props(styles.parent)}>{parent}</div> : null}
          <h1 {...stylex.props(foundationStyles.pageTitle)}>{title}</h1>
          {description ? (
            <div {...stylex.props(styles.description)}>{description}</div>
          ) : null}
        </div>
        {actions || menu ? (
          <div {...stylex.props(styles.headerActions)}>
            {actions}
            {menu}
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function PageSection({
  children,
  count,
  heading,
  intro,
}: {
  children: ReactNode;
  count?: number;
  heading: ReactNode;
  intro?: ReactNode;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <div {...stylex.props(styles.sectionHeader)}>
        <SectionHeading count={count}>{heading}</SectionHeading>
        {intro ? (
          <div {...stylex.props(styles.sectionIntro)}>{intro}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function RailSection({
  children,
  heading,
}: {
  children: ReactNode;
  heading: ReactNode;
}) {
  return (
    <section {...stylex.props(styles.railSection)}>
      <h2 {...stylex.props(styles.railHeading)}>{heading}</h2>
      {children}
    </section>
  );
}

const styles = stylex.create({
  document: {
    minHeight: "100dvh",
    backgroundColor: colors.ground,
    color: colors.ink,
  },
  page: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "1320px",
    marginRight: "auto",
    marginLeft: "auto",
    paddingTop: space.x8,
    paddingRight: space.x8,
    paddingBottom: space.x12,
    paddingLeft: space.x8,
    [NARROW]: {
      paddingTop: space.x6,
      paddingRight: "20px",
      paddingBottom: space.x8,
      paddingLeft: "20px",
    },
  },
  footer: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "1320px",
    marginRight: "auto",
    marginLeft: "auto",
    paddingRight: space.x8,
    paddingBottom: space.x8,
    paddingLeft: space.x8,
    [NARROW]: {
      paddingRight: "20px",
      paddingLeft: "20px",
    },
  },
  columns: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 336px",
    gap: space.x12,
    alignItems: "start",
    [NARROW]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  singleColumn: {
    gridTemplateColumns: "minmax(0, 960px)",
  },
  mainColumn: {
    minWidth: 0,
  },
  rail: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x8,
    [NARROW]: {
      display: "none",
    },
  },
  stackedRail: {
    [NARROW]: {
      display: "flex",
    },
  },
  pageHeader: {
    padding: { default: space.x6, [MOBILE]: space.x4 },
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  pageHeaderBody: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space.x6,
    marginTop: space.x3,
    [NARROW]: {
      alignItems: "flex-start",
      flexDirection: "column",
    },
  },
  pageHeaderCopy: {
    minWidth: 0,
  },
  eyebrow: {
    marginBottom: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  parent: {
    marginBottom: space.x1,
    color: colors.accentDeep,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.3,
  },
  description: {
    maxWidth: "680px",
    marginTop: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.55,
  },
  headerActions: {
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    gap: space.x2,
    flexWrap: "wrap",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    rowGap: space.x3,
    marginTop: space.x8,
  },
  sectionHeader: {
    paddingBottom: space.x2,
  },
  sectionIntro: {
    maxWidth: "620px",
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  railSection: {
    display: "flex",
    flexDirection: "column",
    rowGap: space.x2,
  },
  railHeading: {
    margin: 0,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
});
