"use client";

import * as stylex from "@stylexjs/stylex";
import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";

import { TextLink } from "..";
import { foundationStyles } from "../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../styles/tokens.stylex";

export type AdminBreadcrumb = {
  current?: boolean;
  href: string;
  label: string;
};

export function AdminBreadcrumbs({
  items,
}: {
  items: readonly AdminBreadcrumb[];
}) {
  return (
    <nav aria-label="Breadcrumb" {...stylex.props(styles.breadcrumbs)}>
      <ol {...stylex.props(styles.breadcrumbList)}>
        <li>
          <Link
            aria-label="Admin"
            href="/admin"
            {...stylex.props(styles.breadcrumbLink)}
          >
            <Home aria-hidden="true" size={14} />
          </Link>
        </li>
        {items.map((item) => (
          <li
            key={`${item.href}-${item.label}`}
            {...stylex.props(styles.breadcrumbItem)}
          >
            <ChevronRight
              aria-hidden="true"
              size={13}
              {...stylex.props(styles.breadcrumbSeparator)}
            />
            <Link
              aria-current={item.current ? "page" : undefined}
              href={item.href}
              {...stylex.props(
                styles.breadcrumbLink,
                item.current && styles.currentBreadcrumb,
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function AdminPage({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.page)}>{children}</div>;
}

export type AdminPageHeaderProps = {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  metadata?: ReactNode;
  title: ReactNode;
};

export function AdminPageHeader({
  actions,
  description,
  eyebrow,
  metadata,
  title,
}: AdminPageHeaderProps) {
  return (
    <header {...stylex.props(styles.pageHeader)}>
      <div {...stylex.props(styles.pageHeaderCopy)}>
        {eyebrow ? (
          <div {...stylex.props(styles.eyebrow)}>{eyebrow}</div>
        ) : null}
        <h1 {...stylex.props(foundationStyles.pageTitle, styles.pageTitle)}>
          {title}
        </h1>
        {description ? (
          <div {...stylex.props(styles.description)}>{description}</div>
        ) : null}
        {metadata ? (
          <div {...stylex.props(styles.metadata)}>{metadata}</div>
        ) : null}
      </div>
      {actions ? <div {...stylex.props(styles.actions)}>{actions}</div> : null}
    </header>
  );
}

export type AdminSectionProps = Omit<
  HTMLAttributes<HTMLElement>,
  "className" | "style" | "title"
> & {
  action?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  title?: ReactNode;
  tone?: "default" | "accent" | "danger" | "warning";
};

export function AdminSection({
  action,
  children,
  description,
  title,
  tone = "default",
  ...props
}: AdminSectionProps) {
  return (
    <section {...props} {...stylex.props(styles.section, toneStyles[tone])}>
      {title || description || action ? (
        <div {...stylex.props(styles.sectionHeader)}>
          <div {...stylex.props(styles.sectionCopy)}>
            {title ? (
              <h2 {...stylex.props(foundationStyles.sectionHeading)}>
                {title}
              </h2>
            ) : null}
            {description ? (
              <div {...stylex.props(styles.description)}>{description}</div>
            ) : null}
          </div>
          {action ? (
            <div {...stylex.props(styles.sectionAction)}>{action}</div>
          ) : null}
        </div>
      ) : null}
      <div {...stylex.props(styles.sectionBody)}>{children}</div>
    </section>
  );
}

export function AdminActions({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.actions)}>{children}</div>;
}

export function AdminStatGrid({ children }: { children: ReactNode }) {
  return <dl {...stylex.props(styles.statGrid)}>{children}</dl>;
}

export function AdminStat({
  detail,
  label,
  value,
}: {
  detail?: ReactNode;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.stat)}>
      <dt {...stylex.props(styles.statLabel)}>{label}</dt>
      <dd {...stylex.props(styles.statValue)}>{value}</dd>
      {detail ? <div {...stylex.props(styles.statDetail)}>{detail}</div> : null}
    </div>
  );
}

export function AdminStatus({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "accent" | "danger" | "neutral" | "success" | "warning";
}) {
  return (
    <span {...stylex.props(styles.status, statusToneStyles[tone])}>
      {children}
    </span>
  );
}

export function AdminTextLink({
  children,
  href,
  title,
  truncate = false,
}: {
  children: ReactNode;
  href: string;
  title?: string;
  truncate?: boolean;
}) {
  return (
    <TextLink href={href} title={title} truncate={truncate}>
      {children}
    </TextLink>
  );
}

export function AdminCode({ children }: { children: ReactNode }) {
  return <code {...stylex.props(styles.code)}>{children}</code>;
}

export function AdminCodeBlock({ children }: { children: ReactNode }) {
  return <pre {...stylex.props(styles.codeBlock)}>{children}</pre>;
}

export function AdminDetails({
  children,
  open,
  summary,
}: {
  children: ReactNode;
  open?: boolean;
  summary: ReactNode;
}) {
  return (
    <details open={open || undefined} {...stylex.props(styles.details)}>
      <summary {...stylex.props(styles.detailsSummary)}>{summary}</summary>
      <div {...stylex.props(styles.detailsBody)}>{children}</div>
    </details>
  );
}

export function AdminSplitView({
  detail,
  list,
  selected,
}: {
  detail: ReactNode;
  list: ReactNode;
  selected: boolean;
}) {
  return (
    <div {...stylex.props(styles.splitView)}>
      <div
        {...stylex.props(styles.splitList, selected && styles.splitListHidden)}
      >
        {list}
      </div>
      <div
        {...stylex.props(
          styles.splitDetail,
          !selected && styles.splitDetailHidden,
        )}
      >
        {detail}
      </div>
    </div>
  );
}

const styles = stylex.create({
  page: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x6,
  },
  breadcrumbs: { minWidth: 0 },
  breadcrumbList: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x2,
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  breadcrumbItem: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x2,
  },
  breadcrumbSeparator: { flexShrink: 0, color: colors.hairline },
  breadcrumbLink: {
    display: "inline-flex",
    minWidth: 0,
    alignItems: "center",
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: {
      default: colors.inkMuted,
      ":hover": colors.accentDeep,
      ":active": colors.accent,
    },
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.3,
    textDecoration: "none",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    overflow: "hidden",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
  },
  currentBreadcrumb: { color: colors.ink, fontWeight: 600 },
  pageHeader: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: space.x6,
    paddingBottom: 0,
    "@media (max-width: 639px)": {
      alignItems: "stretch",
      flexDirection: "column",
    },
  },
  pageHeaderCopy: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x2,
  },
  eyebrow: {
    color: colors.accentDeep,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.1em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  pageTitle: { fontSize: "clamp(30px, 5vw, 40px)", overflowWrap: "anywhere" },
  description: {
    maxWidth: "68ch",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "14px",
    lineHeight: 1.55,
  },
  metadata: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.45,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    flexWrap: "wrap",
  },
  section: {
    boxSizing: "border-box",
    minWidth: 0,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    backgroundColor: "transparent",
  },
  sectionAccent: { borderColor: colors.accent },
  sectionWarning: {
    borderColor: colors.dataAccent,
    backgroundColor: colors.accentTint,
  },
  sectionDanger: { borderColor: colors.critical },
  sectionHeader: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.x4,
    padding: { default: space.x6, "@media (max-width: 639px)": space.x4 },
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  sectionCopy: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x2,
  },
  sectionAction: { flexShrink: 0 },
  sectionBody: {
    minWidth: 0,
    padding: { default: space.x6, "@media (max-width: 639px)": space.x4 },
  },
  statGrid: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: space.x3,
    margin: 0,
    padding: 0,
  },
  stat: {
    minWidth: 0,
    padding: space.x4,
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    backgroundColor: "transparent",
  },
  statLabel: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  statValue: {
    margin: 0,
    marginTop: space.x2,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "28px",
    fontWeight: 700,
    lineHeight: 1,
  },
  statDetail: {
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.4,
  },
  status: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "22px",
    paddingRight: space.x2,
    paddingLeft: space.x2,
    borderRadius: controlMetrics.radiusSmall,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 600,
    lineHeight: 1.2,
  },
  statusNeutral: { backgroundColor: colors.inset, color: colors.inkMuted },
  statusAccent: {
    backgroundColor: colors.accentTint,
    color: colors.accentDeep,
  },
  statusSuccess: { backgroundColor: colors.inset, color: colors.ink },
  statusWarning: { backgroundColor: colors.accentTint, color: colors.ink },
  statusDanger: {
    backgroundColor: colors.accentTint,
    color: colors.accentDeep,
  },
  code: {
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "0.92em",
    overflowWrap: "anywhere",
  },
  codeBlock: {
    boxSizing: "border-box",
    maxWidth: "100%",
    margin: 0,
    padding: space.x4,
    overflowX: "auto",
    backgroundColor: colors.inset,
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },
  details: {
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    backgroundColor: "transparent",
  },
  detailsSummary: {
    padding: space.x4,
    color: colors.ink,
    fontFamily: fonts.display,
    fontWeight: 700,
    listStyle: "none",
    cursor: "pointer",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
    "::-webkit-details-marker": { display: "none" },
  },
  detailsBody: {
    paddingTop: 0,
    paddingRight: space.x4,
    paddingBottom: space.x4,
    paddingLeft: space.x4,
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  splitView: {
    display: "grid",
    minWidth: 0,
    minHeight: "70dvh",
    gridTemplateColumns: "minmax(260px, 340px) minmax(0, 1fr)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    backgroundColor: "transparent",
    "@media (max-width: 839px)": { display: "block" },
  },
  splitList: {
    minWidth: 0,
    borderRightWidth: "1px",
    borderRightStyle: "solid",
    borderRightColor: colors.hairline,
    "@media (max-width: 839px)": { borderRightWidth: 0 },
  },
  splitListHidden: { "@media (max-width: 839px)": { display: "none" } },
  splitDetail: { minWidth: 0 },
  splitDetailHidden: { "@media (max-width: 839px)": { display: "none" } },
});

const toneStyles = {
  accent: styles.sectionAccent,
  danger: styles.sectionDanger,
  default: null,
  warning: styles.sectionWarning,
} as const;

const statusToneStyles = {
  accent: styles.statusAccent,
  danger: styles.statusDanger,
  neutral: styles.statusNeutral,
  success: styles.statusSuccess,
  warning: styles.statusWarning,
} as const;
