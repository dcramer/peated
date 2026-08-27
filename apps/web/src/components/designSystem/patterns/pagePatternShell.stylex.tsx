"use client";

import * as stylex from "@stylexjs/stylex";
import { CircleUserRound } from "lucide-react";
import { type ReactNode, useState } from "react";

import { foundationStyles } from "../../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import {
  ApplicationHeader,
  BottleVisual,
  Button,
  ScopedSearch,
  SectionHeading,
  SiteFooter,
} from "../components";

const NARROW = "@media (max-width: 759px)";
const MOBILE = "@media (max-width: 559px)";

const databaseItems = [
  { href: "/bottles", label: "Bottles" },
  { href: "/distillers", label: "Distillers" },
  { href: "/brands", label: "Brands" },
  { href: "/bottlers", label: "Bottlers" },
  { href: "/map", label: "Map" },
] as const;

const personalItems = [
  { count: 41, href: "/library", label: "Library" },
  { count: 412, href: "/tastings", label: "Tastings" },
  { count: 38, href: "/friends", label: "Friends" },
] as const;

const signedOutAccountItems = [
  { href: "/login", label: "Sign in" },
  { href: "/register", label: "Create an account" },
] as const;

const scopes = [
  { label: "Everything", value: "all" },
  { label: "Bottles", value: "bottles" },
  { label: "Distillers", value: "distillers" },
] as const;

const footerGroups = [
  {
    label: "Database",
    links: [
      { href: "/bottles", label: "Bottles" },
      { href: "/distillers", label: "Distillers" },
      { href: "/brands", label: "Brands" },
    ],
  },
  {
    label: "Your record",
    links: [
      { href: "/library", label: "Library" },
      { href: "/tastings", label: "Tastings" },
      { href: "/friends", label: "Friends" },
    ],
  },
  {
    label: "Contribute",
    links: [
      { href: "/addBottle", label: "Record a bottle" },
      { href: "/addEntity", label: "Add a distiller" },
      { href: "/addTasting", label: "Log a tasting" },
    ],
  },
  {
    label: "About",
    links: [
      { href: "/about", label: "About Peated" },
      { href: "/about/ratings", label: "Rating systems" },
      { href: "/terms", label: "Terms" },
    ],
  },
] as const;

export function PagePatternShell({
  children,
  currentHref,
  footer = true,
  signedIn = true,
}: {
  children: ReactNode;
  currentHref: string;
  footer?: boolean;
  signedIn?: boolean;
}) {
  const [scope, setScope] = useState("all");

  return (
    <PageFrame
      header={
        <ApplicationHeader
          account={<CircleUserRound aria-hidden="true" size={18} />}
          accountItems={signedIn ? personalItems : signedOutAccountItems}
          action={
            <Button size="sm" variant="accent">
              Log a tasting
            </Button>
          }
          currentHref={currentHref}
          databaseItems={databaseItems}
          personalItems={signedIn ? personalItems : []}
          search={
            <ScopedSearch
              aria-label="Search Peated"
              onScopeChange={setScope}
              placeholder="Search bottles, distillers, brands…"
              scope={scope}
              scopes={scopes}
            />
          }
        />
      }
      footer={
        footer ? (
          <SiteFooter
            coverage="47,392 bottles · 2,418 brands, distillers & bottlers · updated daily"
            groups={footerGroups}
            provenance="Community-maintained whisky records"
            referenceLinks={[
              { href: "/about/smws-codes", label: "SMWS distillery codes" },
            ]}
            statement="A whisky database built from the bottles people actually drink."
          />
        ) : undefined
      }
    >
      {children}
    </PageFrame>
  );
}

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
      <a href="#main-content" {...stylex.props(styles.skipLink)}>
        Skip to content
      </a>
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
}: {
  children: ReactNode;
  rail?: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.columns, !rail && styles.singleColumn)}>
      <div {...stylex.props(styles.mainColumn)}>{children}</div>
      {rail ? <aside {...stylex.props(styles.rail)}>{rail}</aside> : null}
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

export function Panel({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.panel)}>{children}</div>;
}

export function MeasurePanel({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div {...stylex.props(styles.measurePanel)}>
      <div {...stylex.props(styles.measureLabel)}>{label}</div>
      {children}
    </div>
  );
}

export function RecordList({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <ul aria-label={ariaLabel} {...stylex.props(styles.recordList)}>
      {children}
    </ul>
  );
}

export function RecordRow({
  action,
  description,
  end,
  href,
  leading,
  metadata,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  end?: ReactNode;
  href?: string;
  leading?: ReactNode;
  metadata?: ReactNode;
  title: ReactNode;
}) {
  const Title = href ? "a" : "span";

  return (
    <li {...stylex.props(styles.recordRow)}>
      {leading ? <div {...stylex.props(styles.leading)}>{leading}</div> : null}
      <div {...stylex.props(styles.recordCopy)}>
        <Title href={href} {...stylex.props(styles.recordTitle)}>
          {title}
        </Title>
        {metadata ? (
          <div {...stylex.props(styles.recordMetadata)}>{metadata}</div>
        ) : null}
        {description ? (
          <div {...stylex.props(styles.recordDescription)}>{description}</div>
        ) : null}
      </div>
      {end ? <div {...stylex.props(styles.recordEnd)}>{end}</div> : null}
      {action ? (
        <div {...stylex.props(styles.recordAction)}>{action}</div>
      ) : null}
    </li>
  );
}

export function BottleThumbnail({ label }: { label: string }) {
  return <BottleVisual label={label} size="sm" />;
}

export function Avatar({ initials }: { initials: string }) {
  return <span {...stylex.props(styles.avatar)}>{initials}</span>;
}

export function TextLink({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return (
    <a href={href} {...stylex.props(styles.textLink)}>
      {children}
    </a>
  );
}

const styles = stylex.create({
  document: {
    minHeight: "100dvh",
    backgroundColor: colors.ground,
    color: colors.ink,
  },
  skipLink: {
    position: "fixed",
    zIndex: 100,
    top: space.x2,
    left: space.x2,
    paddingTop: space.x2,
    paddingRight: space.x3,
    paddingBottom: space.x2,
    paddingLeft: space.x3,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.ink,
    color: colors.ground,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.2,
    textDecoration: "none",
    transform: {
      default: "translateY(-160%)",
      ":focus": "translateY(0)",
    },
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
  panel: {
    padding: space.x4,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  measurePanel: {
    display: "flex",
    flexDirection: "column",
    rowGap: space.x3,
    padding: space.x4,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  measureLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  recordList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  recordRow: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x3,
    paddingTop: "14px",
    paddingBottom: "14px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    ":first-child": {
      borderTopWidth: "1px",
      borderTopStyle: "solid",
      borderTopColor: colors.hairline,
    },
  },
  leading: {
    display: "flex",
    width: "48px",
    minHeight: "56px",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  recordCopy: {
    minWidth: 0,
    flex: 1,
  },
  recordTitle: {
    display: "block",
    overflow: "hidden",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
    textDecoration: "none",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  recordMetadata: {
    marginTop: space.x1,
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.4,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  recordDescription: {
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
  },
  recordEnd: {
    display: "flex",
    minWidth: 0,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "flex-end",
    [MOBILE]: {
      maxWidth: "92px",
    },
  },
  recordAction: {
    display: "flex",
    flexShrink: 0,
  },
  avatar: {
    display: "inline-flex",
    width: "38px",
    height: "38px",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    backgroundColor: colors.inset,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1,
  },
  textLink: {
    color: colors.accentDeep,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.3,
    textDecoration: "none",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
});
