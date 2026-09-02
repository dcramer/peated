import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { PageTabs, SectionHeading, SkipLink, type PageTabItem } from "..";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, fonts, space } from "../../styles/tokens.stylex";

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

/** Places page content beside an optional side column, with a header above the main column. */
export function PageColumns({
  children,
  equal = false,
  header,
  rail,
  railBehavior = "hide",
}: {
  children: ReactNode;
  equal?: boolean;
  header?: ReactNode;
  rail?: ReactNode;
  railBehavior?: "hide" | "stack";
}) {
  return (
    <div
      {...stylex.props(
        styles.columns,
        header ? styles.columnsWithHeader : null,
        equal && styles.equalColumns,
        !rail && styles.singleColumn,
      )}
    >
      {header ? <div {...stylex.props(styles.mainColumn)}>{header}</div> : null}
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
  actionsPosition = "end",
  description,
  eyebrow,
  identity,
  menu,
  parent,
  title,
}: {
  actions?: ReactNode;
  /** Inline actions stay beside the title and wrap to the right when space runs out. */
  actionsPosition?: "end" | "start" | "inline";
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
      <div
        {...stylex.props(
          styles.pageHeaderBody,
          actionsPosition === "start" && styles.startHeaderActions,
          actionsPosition === "inline" && styles.inlineHeaderActions,
        )}
      >
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
          <div
            {...stylex.props(
              styles.headerActions,
              actionsPosition === "inline" && styles.inlineActions,
            )}
          >
            {actions}
            {menu}
          </div>
        ) : null}
      </div>
    </header>
  );
}

/** Keeps a detail page header and its tab content aligned. */
export function TabbedPage({
  children,
  currentHref,
  header,
  tabs,
  tabsLabel,
}: {
  children: ReactNode;
  currentHref: string;
  header: ReactNode;
  tabs: readonly [PageTabItem, ...PageTabItem[]];
  tabsLabel: string;
}) {
  return (
    <div {...stylex.props(styles.tabbedPage)}>
      {header}
      <div {...stylex.props(styles.pageTabs)}>
        <PageTabs
          ariaLabel={tabsLabel}
          currentHref={currentHref}
          items={tabs}
        />
      </div>
      <div {...stylex.props(styles.pageTabContent)}>{children}</div>
    </div>
  );
}

export function PageSection({
  children,
  heading,
  intro,
}: {
  children: ReactNode;
  heading: ReactNode;
  intro?: ReactNode;
}) {
  return (
    <section {...stylex.props(styles.section)}>
      <div {...stylex.props(styles.sectionHeader)}>
        <SectionHeading>{heading}</SectionHeading>
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
    minHeight: "calc(100dvh - 118px)",
    width: "100%",
    maxWidth: "1320px",
    marginRight: "auto",
    marginLeft: "auto",
    paddingTop: space.x8,
    paddingRight: `max(${space.x8}, env(safe-area-inset-right))`,
    paddingBottom: `max(${space.x12}, env(safe-area-inset-bottom))`,
    paddingLeft: `max(${space.x8}, env(safe-area-inset-left))`,
    [NARROW]: {
      minHeight: "calc(100dvh - 70px)",
      paddingTop: space.x6,
      paddingRight: "max(20px, env(safe-area-inset-right))",
      paddingBottom: `max(${space.x8}, env(safe-area-inset-bottom))`,
      paddingLeft: "max(20px, env(safe-area-inset-left))",
    },
  },
  footer: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "1320px",
    marginRight: "auto",
    marginLeft: "auto",
    paddingRight: `max(${space.x8}, env(safe-area-inset-right))`,
    paddingBottom: `max(${space.x8}, env(safe-area-inset-bottom))`,
    paddingLeft: `max(${space.x8}, env(safe-area-inset-left))`,
    [NARROW]: {
      paddingRight: "max(20px, env(safe-area-inset-right))",
      paddingLeft: "max(20px, env(safe-area-inset-left))",
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
  equalColumns: {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    [NARROW]: {
      gridTemplateColumns: "minmax(0, 1fr)",
    },
  },
  columnsWithHeader: {
    rowGap: space.x4,
  },
  singleColumn: {
    gridTemplateColumns: "minmax(0, 960px)",
  },
  mainColumn: {
    minWidth: 0,
    gridColumn: 1,
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
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: "18px",
    paddingLeft: 0,
    backgroundColor: "transparent",
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
  startHeaderActions: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: space.x4,
  },
  inlineHeaderActions: {
    flexWrap: "wrap",
    [NARROW]: {
      alignItems: "flex-end",
      flexDirection: "row",
    },
  },
  inlineActions: {
    marginLeft: "auto",
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
    gap: { default: space.x2, [MOBILE]: space.x1 },
    flexWrap: "wrap",
  },
  tabbedPage: {
    minWidth: 0,
  },
  pageTabs: {
    marginTop: space.x6,
  },
  pageTabContent: {
    marginTop: space.x4,
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
