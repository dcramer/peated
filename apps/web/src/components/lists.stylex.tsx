import * as stylex from "@stylexjs/stylex";
import { ChevronDown, Download } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes } from "react";

import { foundationStyles } from "../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../styles/tokens.stylex";
import { AppLink } from "./appLink";
import { ButtonLink, IconButton } from "./button.stylex";
import { ItemList, ItemListItem } from "./itemList.stylex";
import { getTextTitle } from "./textTitle";

const COMPACT = "@media (max-width: 639px)";

export type ListSortOption = {
  label: string;
  value: string;
};

export type ListToolbarProps = {
  count: number;
  mobileAction?: ReactNode;
  noun: string;
  pluralNoun?: string;
  onExport?: () => void;
  onSortChange: (value: string) => void;
  pending?: boolean;
  sort: string;
  sortOptions: readonly [ListSortOption, ...ListSortOption[]];
  total?: number;
};

/** Keeps sorting available while pending results retain their last settled count. */
export function ListToolbar({
  count,
  mobileAction,
  noun,
  pluralNoun = `${noun}s`,
  onExport,
  onSortChange,
  pending = false,
  sort,
  sortOptions,
  total,
}: ListToolbarProps) {
  return (
    <div
      {...stylex.props(
        styles.toolbar,
        Boolean(mobileAction) && styles.toolbarWithMobileAction,
      )}
    >
      <p aria-live="polite" {...stylex.props(styles.count)}>
        <strong {...stylex.props(styles.countValue)}>
          {count.toLocaleString("en-US")} {count === 1 ? noun : pluralNoun}
        </strong>
        {total !== undefined ? (
          <span
            {...stylex.props(foundationStyles.metadata, styles.countDetail)}
          >
            of {total.toLocaleString("en-US")}
          </span>
        ) : null}
      </p>
      <div {...stylex.props(styles.actions)}>
        <span
          role="status"
          {...stylex.props(foundationStyles.metadata, styles.status)}
        >
          {pending ? "Updating…" : null}
        </span>
        <span {...stylex.props(Boolean(mobileAction) && styles.wideSort)}>
          <ListSort
            noun={pluralNoun}
            onChange={onSortChange}
            options={sortOptions}
            value={sort}
          />
        </span>
        {onExport ? (
          <IconButton
            icon={<Download aria-hidden="true" size={15} strokeWidth={1.75} />}
            label={`Export ${noun}s`}
            onClick={onExport}
            size="sm"
            variant="text"
          />
        ) : null}
        {mobileAction ? (
          <span {...stylex.props(styles.mobileAction)}>{mobileAction}</span>
        ) : null}
      </div>
    </div>
  );
}

export function ListSort({
  fullWidth = false,
  noun,
  onChange,
  options,
  value,
}: {
  fullWidth?: boolean;
  noun: string;
  onChange: (value: string) => void;
  options: readonly [ListSortOption, ...ListSortOption[]];
  value: string;
}) {
  return (
    <label
      {...stylex.props(
        foundationStyles.fieldLabel,
        styles.sortLabel,
        fullWidth && styles.fullWidthSort,
      )}
    >
      <span>Sort</span>
      <CompactSelect
        aria-label={`Sort ${noun}`}
        fullWidth={fullWidth}
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </CompactSelect>
    </label>
  );
}

function CompactSelect({
  children,
  fullWidth = false,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { fullWidth?: boolean }) {
  return (
    <span
      {...stylex.props(
        styles.selectWrapper,
        fullWidth && styles.fullWidthSelect,
      )}
    >
      <select
        {...props}
        {...stylex.props(
          foundationStyles.input,
          styles.select,
          fullWidth && styles.fullWidthSelectControl,
        )}
      >
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

export type CursorPagerProps = {
  ariaLabel?: string;
  nextHref?: string;
  page?: number;
  previousHref?: string;
};

/** Prefetches API-owned page links and shows their Next.js navigation progress. */
export function CursorPager({
  ariaLabel = "Pages",
  nextHref,
  page,
  previousHref,
}: CursorPagerProps) {
  if (!previousHref && !nextHref) return null;

  return (
    <nav aria-label={ariaLabel} {...stylex.props(styles.pagination)}>
      {page !== undefined ? (
        <span {...stylex.props(foundationStyles.metadata, styles.pageNumber)}>
          Page {page}
        </span>
      ) : null}
      <div
        {...stylex.props(
          styles.paginationLinks,
          page === undefined && styles.paginationLinksWithoutPage,
        )}
      >
        {previousHref ? (
          <ButtonLink
            href={previousHref}
            prefetch={null}
            rel="prev"
            size="sm"
            variant="tonal"
          >
            ← Previous
          </ButtonLink>
        ) : null}
        {nextHref ? (
          <ButtonLink
            href={nextHref}
            prefetch={null}
            rel="next"
            size="sm"
            variant="tonal"
          >
            Next →
          </ButtonLink>
        ) : null}
      </div>
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
    <div {...stylex.props(styles.railList)}>
      <ItemList ariaLabel={ariaLabel}>{children}</ItemList>
    </div>
  );
}

export type RailListItemProps = {
  end?: ReactNode;
  href?: string;
  leading?: ReactNode;
  metadata?: ReactNode;
  title: string;
};

/** Generic sidebar links, such as help pages or reviewers. Catalog items use their domain IdentityRow inside ItemListItem. */
export function RailListItem({
  end,
  href,
  leading,
  metadata,
  title,
}: RailListItemProps) {
  return (
    <ItemListItem>
      <div {...stylex.props(styles.railRow)}>
        {leading}
        <div {...stylex.props(styles.railCopy)}>
          {href ? (
            <AppLink
              href={href}
              title={title}
              {...stylex.props(
                foundationStyles.compactRowTitle,
                styles.railTitle,
                styles.railTitleLink,
              )}
            >
              {title}
            </AppLink>
          ) : (
            <span
              title={title}
              {...stylex.props(
                foundationStyles.compactRowTitle,
                styles.railTitle,
              )}
            >
              {title}
            </span>
          )}
          {metadata ? (
            <span
              title={getTextTitle(metadata)}
              {...stylex.props(foundationStyles.metadata, styles.railMetadata)}
            >
              {metadata}
            </span>
          ) : null}
        </div>
        {end ? (
          <span {...stylex.props(foundationStyles.metadata, styles.railEnd)}>
            {end}
          </span>
        ) : null}
      </div>
    </ItemListItem>
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
    [COMPACT]: {
      alignItems: "flex-start",
      flexDirection: "column",
    },
  },
  toolbarWithMobileAction: {
    [COMPACT]: {
      alignItems: "center",
      flexDirection: "row",
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
    fontSize: "20px",
    fontWeight: 700,
    letterSpacing: "-0.025em",
    lineHeight: 1.2,
  },
  countDetail: {
    color: colors.inkMuted,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
  },
  status: {
    minWidth: "9ch",
  },
  sortLabel: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    color: colors.inkMuted,
  },
  fullWidthSort: {
    width: "100%",
    flexDirection: "column",
    alignItems: "stretch",
  },
  wideSort: {
    display: "inline-flex",
    ["@media (max-width: 759px)"]: {
      display: "none",
    },
  },
  mobileAction: {
    display: "none",
    ["@media (max-width: 759px)"]: {
      display: "inline-flex",
    },
  },
  selectWrapper: {
    position: "relative",
    display: "inline-flex",
    maxWidth: "176px",
  },
  fullWidthSelect: {
    width: "100%",
    maxWidth: "none",
  },
  fullWidthSelectControl: {
    width: "100%",
  },
  select: {
    height: controlMetrics.controlHeightSmall,
    maxWidth: "100%",
    appearance: "none",
    paddingRight: space.x6,
    paddingLeft: "11px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.fieldRule,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundImage: "none",
    backgroundColor: colors.inset,
    color: colors.ink,
    fontWeight: 600,
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
  paginationLinksWithoutPage: {
    width: "100%",
    justifyContent: "space-between",
  },
  pageNumber: {
    color: colors.inkMuted,
    fontVariantNumeric: "tabular-nums",
  },
  railList: {
    padding: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
  },
  railRow: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    gap: space.x3,
    paddingTop: "10px",
    paddingBottom: "10px",
  },
  railCopy: {
    minWidth: 0,
    flex: 1,
  },
  railTitle: {
    display: "block",
    overflow: "hidden",
    color: colors.ink,
    textDecoration: "none",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  railTitleLink: {
    color: {
      default: colors.ink,
      ":hover": colors.accentDeep,
      ":active": colors.accentDeep,
    },
  },
  railMetadata: {
    display: "block",
    marginTop: "2px",
    overflow: "hidden",
    color: colors.inkMuted,
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
    fontVariantNumeric: "tabular-nums",
  },
});
