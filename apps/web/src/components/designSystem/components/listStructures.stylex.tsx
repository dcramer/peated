import * as stylex from "@stylexjs/stylex";
import { ChevronDown, Download } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes } from "react";

import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import { ButtonLink, IconButton } from "./button.stylex";

const COMPACT = "@media (max-width: 639px)";

export type ListSortOption = {
  label: string;
  value: string;
};

export type ListToolbarProps = {
  count: number;
  noun: string;
  onExport?: () => void;
  onSortChange: (value: string) => void;
  sort: string;
  sortOptions: readonly [ListSortOption, ...ListSortOption[]];
  total?: number;
};

/** Pairs the record count with sorting and optional export actions. */
export function ListToolbar({
  count,
  noun,
  onExport,
  onSortChange,
  sort,
  sortOptions,
  total,
}: ListToolbarProps) {
  return (
    <div {...stylex.props(styles.toolbar)}>
      <p aria-live="polite" {...stylex.props(styles.count)}>
        <strong {...stylex.props(styles.countValue)}>
          {count.toLocaleString("en-US")} {count === 1 ? noun : `${noun}s`}
        </strong>
        {total !== undefined ? (
          <span {...stylex.props(styles.countDetail)}>
            of {total.toLocaleString("en-US")}
          </span>
        ) : null}
      </p>
      <div {...stylex.props(styles.actions)}>
        <label {...stylex.props(styles.sortLabel)}>
          <span>Sort</span>
          <CompactSelect
            aria-label="Sort records"
            onChange={(event) => onSortChange(event.currentTarget.value)}
            value={sort}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </CompactSelect>
        </label>
        {onExport ? (
          <IconButton
            icon={<Download aria-hidden="true" size={15} strokeWidth={1.75} />}
            label="Export records"
            onClick={onExport}
            size="sm"
            variant="text"
          />
        ) : null}
      </div>
    </div>
  );
}

function CompactSelect({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span {...stylex.props(styles.selectWrapper)}>
      <select {...props} {...stylex.props(styles.select)}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        size={14}
        strokeWidth={1.75}
        {...stylex.props(styles.selectIcon)}
      />
    </span>
  );
}

export function PeriodHeader({ children }: { children: ReactNode }) {
  return <h3 {...stylex.props(styles.period)}>{children}</h3>;
}

export type CursorPagerProps = {
  ariaLabel?: string;
  nextHref?: string;
  page: number;
  previousHref?: string;
};

/** Presents only the cursor actions supplied by the owning API. */
export function CursorPager({
  ariaLabel = "Record pages",
  nextHref,
  page,
  previousHref,
}: CursorPagerProps) {
  if (!previousHref && !nextHref) return null;

  return (
    <nav aria-label={ariaLabel} {...stylex.props(styles.pagination)}>
      <div {...stylex.props(styles.paginationLinks)}>
        {previousHref ? (
          <ButtonLink href={previousHref} rel="prev" size="sm" variant="tonal">
            ← Previous
          </ButtonLink>
        ) : null}
        {nextHref ? (
          <ButtonLink href={nextHref} rel="next" size="sm" variant="tonal">
            Next →
          </ButtonLink>
        ) : null}
      </div>
      <span {...stylex.props(styles.pageNumber)}>Page {page}</span>
    </nav>
  );
}

export function RailList({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <ul aria-label={ariaLabel} {...stylex.props(styles.railList)}>
      {children}
    </ul>
  );
}

export type RailListItemProps = {
  end?: ReactNode;
  href?: string;
  metadata?: string;
  title: string;
};

export function RailListItem({
  end,
  href,
  metadata,
  title,
}: RailListItemProps) {
  return (
    <li {...stylex.props(styles.railRow)}>
      <div {...stylex.props(styles.railCopy)}>
        {href ? (
          <a href={href} {...stylex.props(styles.railTitle)}>
            {title}
          </a>
        ) : (
          <span {...stylex.props(styles.railTitle)}>{title}</span>
        )}
        {metadata ? (
          <span {...stylex.props(styles.railMetadata)}>{metadata}</span>
        ) : null}
      </div>
      {end ? <span {...stylex.props(styles.railEnd)}>{end}</span> : null}
    </li>
  );
}

const styles = stylex.create({
  toolbar: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x4,
    paddingBottom: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    [COMPACT]: {
      alignItems: "flex-start",
      flexDirection: "column",
    },
  },
  count: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    gap: space.x2,
    margin: 0,
  },
  countValue: {
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "17px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  countDetail: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.3,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
  },
  sortLabel: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  selectWrapper: {
    position: "relative",
    display: "inline-flex",
    maxWidth: "176px",
  },
  select: {
    height: controlMetrics.controlHeightSmall,
    maxWidth: "100%",
    appearance: "none",
    paddingRight: space.x6,
    paddingLeft: space.x2,
    borderWidth: 0,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    backgroundImage: "none",
    backgroundColor: colors.inset,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1,
    cursor: "pointer",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  selectIcon: {
    position: "absolute",
    top: "10px",
    right: space.x2,
    color: colors.inkMuted,
    pointerEvents: "none",
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.x3,
    paddingTop: space.x6,
    flexWrap: "wrap",
  },
  paginationLinks: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
  },
  pageNumber: {
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.4,
  },
  period: {
    margin: 0,
    paddingTop: space.x4,
    paddingBottom: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  railList: {
    margin: 0,
    paddingTop: space.x1,
    paddingRight: space.x4,
    paddingBottom: space.x1,
    paddingLeft: space.x4,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
    listStyle: "none",
  },
  railRow: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x3,
    paddingTop: "10px",
    paddingBottom: "10px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    ":last-child": {
      borderBottomWidth: 0,
    },
  },
  railCopy: {
    minWidth: 0,
    flex: 1,
  },
  railTitle: {
    display: "block",
    overflow: "hidden",
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.3,
    textDecoration: "none",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  railMetadata: {
    display: "block",
    marginTop: "2px",
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.35,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  railEnd: {
    display: "inline-flex",
    minWidth: "64px",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "flex-end",
    color: colors.ink,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.3,
  },
});
