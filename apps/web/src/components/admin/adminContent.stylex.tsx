"use client";

import * as stylex from "@stylexjs/stylex";
import { ChevronRight, Home } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { SectionHeading } from "../sectionHeading.stylex";

import { AppLink } from "@peated/web/components/appLink";
import {
  LoadingList,
  LoadingPlaceholder,
} from "@peated/web/components/feedback.stylex";
import { foundationStyles } from "../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../styles/tokens.stylex";
import { LinkPending } from "../linkPending.stylex";
import { AdminTableLoading } from "./adminTable.stylex";

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
          <AppLink
            aria-label="Admin"
            href="/admin"
            prefetch={null}
            {...stylex.props(foundationStyles.metadata, styles.breadcrumbLink)}
          >
            <Home aria-hidden="true" size={14} />
            <LinkPending />
          </AppLink>
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
            <AppLink
              aria-current={item.current ? "page" : undefined}
              href={item.href}
              prefetch={null}
              title={item.label}
              {...stylex.props(
                foundationStyles.metadata,
                styles.breadcrumbLink,
                item.current && styles.currentBreadcrumb,
              )}
            >
              {item.label}
              <LinkPending />
            </AppLink>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function AdminPage({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.page)}>{children}</div>;
}

export function AdminListPageLoading({
  columns = 2,
  label,
  title,
  withSearch = false,
}: {
  columns?: 1 | 2 | 3 | 4;
  label: string;
  title: string;
  withSearch?: boolean;
}) {
  return (
    <AdminPage>
      <AdminPageHeader title={title} />
      <AdminTableLoading
        columns={columns}
        label={label}
        withSearch={withSearch}
      />
    </AdminPage>
  );
}

export function AdminDetailPageLoading({
  label,
  sections = 2,
}: {
  label: string;
  sections?: 1 | 2 | 3;
}) {
  return (
    <div aria-busy="true" aria-label={label} role="status">
      <AdminPage>
        <AdminPageHeader title={<LoadingPlaceholder preset="pageTitle" />} />
        {Array.from({ length: sections }, (_, index) => (
          <AdminSection
            key={index}
            title={
              <LoadingPlaceholder
                delay={loadingDelays[index]}
                preset="heading"
              />
            }
          >
            <LoadingList
              label={`${label}: section ${index + 1}`}
              rows={3}
              variant="text"
            />
          </AdminSection>
        ))}
      </AdminPage>
    </div>
  );
}

export function AdminOverviewPageLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading operations overview"
      role="status"
    >
      <AdminPage>
        <AdminPageHeader
          title="Operations"
          description="See what Peated is processing and what needs attention."
          metadata={<LoadingPlaceholder preset="pageMetadata" />}
        />
        <div {...stylex.props(styles.loadingOverviewGrid)}>
          <AdminSection title="Bottle resolution">
            <LoadingList
              label="Loading Bottle resolution"
              rows={3}
              variant="text"
            />
          </AdminSection>
          <AdminSection title="System status">
            <LoadingList
              label="Loading system status"
              rows={4}
              variant="text"
            />
          </AdminSection>
        </div>
        <AdminSection title="Scraper activity">
          <LoadingList
            label="Loading scraper activity"
            rows={4}
            variant="text"
          />
        </AdminSection>
      </AdminPage>
    </div>
  );
}

export function AdminSectionsPageLoading({
  label,
  sections = 3,
  title,
}: {
  label: string;
  sections?: 2 | 3;
  title: string;
}) {
  return (
    <div aria-busy="true" aria-label={label} role="status">
      <AdminPage>
        <AdminPageHeader title={title} />
        {Array.from({ length: sections }, (_, index) => (
          <AdminSection
            key={index}
            title={
              <LoadingPlaceholder
                delay={loadingDelays[index]}
                preset="heading"
              />
            }
          >
            <LoadingList
              label={`${label}: section ${index + 1}`}
              rows={3}
              variant="text"
            />
          </AdminSection>
        ))}
      </AdminPage>
    </div>
  );
}

const loadingDelays = [0, 1, 2] as const;

export type AdminPageHeaderProps = {
  actions?: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  title: ReactNode;
};

export function AdminPageHeader({
  actions,
  description,
  metadata,
  title,
}: AdminPageHeaderProps) {
  return (
    <header {...stylex.props(styles.pageHeader)}>
      <div {...stylex.props(styles.pageHeaderCopy)}>
        <h1
          {...stylex.props(
            foundationStyles.pageTitle,
            foundationStyles.pageTitleCompact,
            styles.pageTitle,
          )}
        >
          {title}
        </h1>
        {description ? (
          <div {...stylex.props(foundationStyles.body, styles.description)}>
            {description}
          </div>
        ) : null}
        {metadata ? (
          <div {...stylex.props(foundationStyles.metadata, styles.metadata)}>
            {metadata}
          </div>
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
            {title ? <SectionHeading>{title}</SectionHeading> : null}
            {description ? (
              <div {...stylex.props(foundationStyles.body, styles.description)}>
                {description}
              </div>
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
      <dt {...stylex.props(foundationStyles.metadata, styles.statLabel)}>
        {label}
      </dt>
      <dd {...stylex.props(styles.statValue)}>{value}</dd>
      {detail ? (
        <dd {...stylex.props(foundationStyles.metadata, styles.statDetail)}>
          {detail}
        </dd>
      ) : null}
    </div>
  );
}

/** Shows short metadata values with consistently spaced separators. */
export function AdminMetadataList({ items }: { items: readonly ReactNode[] }) {
  return (
    <span {...stylex.props(foundationStyles.metadata, styles.metadataList)}>
      {items.map((item, index) => (
        <span key={index} {...stylex.props(styles.metadataListItem)}>
          {index > 0 ? (
            <span
              aria-hidden="true"
              {...stylex.props(styles.metadataSeparator)}
            >
              ·
            </span>
          ) : null}
          {item}
        </span>
      ))}
    </span>
  );
}

/** Shows a compact status whose text carries the meaning and tone adds emphasis. */
export function AdminStatus({
  children,
  title,
  tone = "neutral",
}: {
  children: ReactNode;
  title?: string;
  tone?: "accent" | "danger" | "neutral" | "success" | "warning";
}) {
  return (
    <span
      title={title}
      {...stylex.props(
        foundationStyles.metadata,
        styles.status,
        statusToneStyles[tone],
      )}
    >
      {children}
    </span>
  );
}

export function AdminCode({ children }: { children: ReactNode }) {
  return (
    <code {...stylex.props(foundationStyles.code, styles.code)}>
      {children}
    </code>
  );
}

export function AdminCodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre {...stylex.props(foundationStyles.code, styles.codeBlock)}>
      {children}
    </pre>
  );
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
      <summary
        {...stylex.props(foundationStyles.interactive, styles.detailsSummary)}
      >
        {summary}
      </summary>
      <div {...stylex.props(foundationStyles.metadata, styles.detailsBody)}>
        {children}
      </div>
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
    <div
      {...stylex.props(styles.splitView, selected && styles.splitViewSelected)}
    >
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
  loadingOverviewGrid: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "minmax(0, 1.3fr) minmax(280px, 0.7fr)",
    gap: space.x4,
    "@media (max-width: 839px)": { gridTemplateColumns: "minmax(0, 1fr)" },
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
    position: "relative",
    display: "inline-flex",
    minWidth: 0,
    alignItems: "center",
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: {
      default: colors.inkMuted,
      ":hover": colors.accentDeep,
      ":active": colors.accentDeep,
    },
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
  pageTitle: { overflowWrap: "anywhere" },
  description: {
    maxWidth: "68ch",
    color: colors.inkMuted,
  },
  metadata: {
    color: colors.inkMuted,
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
    margin: 0,
    marginTop: space.x2,
    color: colors.inkMuted,
  },
  metadataList: { display: "inline" },
  metadataListItem: { display: "inline-block", whiteSpace: "nowrap" },
  metadataSeparator: {
    display: "inline-block",
    marginRight: space.x2,
    marginLeft: space.x2,
  },
  status: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "22px",
    paddingRight: space.x2,
    paddingLeft: space.x2,
    borderRadius: controlMetrics.radiusSmall,
    fontWeight: 600,
  },
  statusNeutral: { backgroundColor: colors.inset, color: colors.inkMuted },
  statusAccent: {
    backgroundColor: colors.accentTint,
    color: colors.accentDeep,
  },
  statusSuccess: { backgroundColor: colors.inset, color: colors.ink },
  statusWarning: { backgroundColor: colors.accentTint, color: colors.ink },
  statusDanger: {
    backgroundColor: colors.criticalQuiet,
    color: colors.ink,
  },
  code: {
    color: colors.ink,
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
  },
  splitView: {
    display: "grid",
    minWidth: 0,
    minHeight: {
      default: "440px",
      "@media (max-width: 839px)": "auto",
    },
    gridTemplateColumns: "minmax(260px, 340px) minmax(0, 1fr)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
    backgroundColor: "transparent",
    "@media (max-width: 839px)": { display: "block" },
  },
  splitViewSelected: {
    minHeight: {
      default: "70dvh",
      "@media (max-width: 839px)": "calc(100dvh - 56px)",
    },
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
