import * as stylex from "@stylexjs/stylex";
import { ChevronDown, Download, LayoutList, Table2 } from "lucide-react";
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
import { LoadingText } from "./feedback.stylex";
import { ItemList, ItemListItem } from "./itemList.stylex";
import { textLinkStyles } from "./textLinkStyles.stylex";
import { getTextTitle } from "./textTitle";

const COMPACT = "@media (max-width: 639px)";
// PageColumns drops its rail at this width.
const PAGE_NARROW = "@media (max-width: 759px)";

export type ListSortOption = {
  label: string;
  value: string;
};

export type ListView = "list" | "table";

export type ListToolbarProps = {
  count: number;
  /**
   * Replaces the sort control below 760px, where PageColumns hides the
   * page's filter rail.
   */
  mobileAction?: ReactNode;
  noun: string;
  /**
   * Clears applied filters from beside the count. Pass it only while filters
   * apply; narrow screens use the Filters drawer's own Clear filters.
   */
  onClear?: () => void;
  pluralNoun?: string;
  onExport?: () => void;
  onSortChange: (value: string) => void;
  /** Shows list and table view buttons when set with `view`. */
  onViewChange?: (view: ListView) => void;
  pending?: boolean;
  sort: string;
  sortOptions: readonly [ListSortOption, ...ListSortOption[]];
  total?: number;
  view?: ListView;
};

/**
 * Keeps sorting available while pending results retain their last settled
 * count. Lists with a compact table view pass `view` and `onViewChange`.
 */
export function ListToolbar({
  count,
  mobileAction,
  noun,
  pluralNoun = `${noun}s`,
  onClear,
  onExport,
  onSortChange,
  onViewChange,
  pending = false,
  sort,
  sortOptions,
  total,
  view,
}: ListToolbarProps) {
  return (
    <div
      {...stylex.props(
        styles.toolbar,
        Boolean(mobileAction) && styles.toolbarWithMobileAction,
      )}
    >
      <p {...stylex.props(styles.count)}>
        <span aria-live="polite" {...stylex.props(styles.countText)}>
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
        </span>
        {onClear ? (
          <span {...stylex.props(foundationStyles.metadata, styles.clear)}>
            <span aria-hidden="true" {...stylex.props(styles.countDetail)}>
              ·
            </span>
            <button
              onClick={onClear}
              type="button"
              {...stylex.props(
                foundationStyles.metadata,
                textLinkStyles.link,
                styles.clearButton,
              )}
            >
              Clear filters
            </button>
          </span>
        ) : null}
      </p>
      <div {...stylex.props(styles.actions)}>
        <span
          role="status"
          {...stylex.props(
            foundationStyles.metadata,
            styles.status,
            Boolean(mobileAction) && styles.statusWithMobileAction,
          )}
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
        {view && onViewChange ? (
          <ListViewToggle onChange={onViewChange} value={view} />
        ) : null}
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

/**
 * Reserves the toolbar while its list loads: the count line, the sort control,
 * the list/table toggle with `view`, and the narrow-screen filters button with
 * `mobileAction`, each at its finished size.
 */
export function ListToolbarLoading({
  mobileAction = false,
  view = false,
}: {
  mobileAction?: boolean;
  view?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      {...stylex.props(
        styles.toolbar,
        mobileAction && styles.toolbarWithMobileAction,
      )}
    >
      <p {...stylex.props(styles.count)}>
        <span {...stylex.props(styles.countValue)}>
          <LoadingText width="7em" />
        </span>
      </p>
      <div {...stylex.props(styles.actions)}>
        <span
          {...stylex.props(
            foundationStyles.metadata,
            styles.status,
            mobileAction && styles.statusWithMobileAction,
          )}
        />
        <span {...stylex.props(mobileAction && styles.wideSort)}>
          <span
            {...stylex.props(foundationStyles.fieldLabel, styles.sortLabel)}
          >
            <span>Sort</span>
            <span {...stylex.props(styles.loadingSelect)} />
          </span>
        </span>
        {view ? (
          <span {...stylex.props(styles.viewToggle)}>
            <span {...stylex.props(styles.loadingIconButton)} />
            <span {...stylex.props(styles.loadingIconButton)} />
          </span>
        ) : null}
        {mobileAction ? (
          <span {...stylex.props(styles.mobileAction)}>
            <span {...stylex.props(styles.loadingFiltersButton)} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

const listViews = [
  {
    icon: LayoutList,
    label: "List view",
    value: "list",
  },
  {
    icon: Table2,
    label: "Table view",
    value: "table",
  },
] as const;

function ListViewToggle({
  onChange,
  value,
}: {
  onChange: (view: ListView) => void;
  value: ListView;
}) {
  return (
    <div aria-label="View" role="group" {...stylex.props(styles.viewToggle)}>
      {listViews.map(({ icon: Icon, label, value: option }) => (
        <IconButton
          aria-pressed={value === option}
          icon={<Icon aria-hidden="true" size={16} strokeWidth={1.75} />}
          key={option}
          label={label}
          onClick={() => onChange(option)}
          size="sm"
          variant={value === option ? "default" : "tonal"}
        />
      ))}
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
  // In a narrow column the controls wrap below the count instead of breaking it.
  toolbar: {
    display: "flex",
    width: "100%",
    minWidth: 0,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: space.x4,
    rowGap: space.x3,
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
  countText: {
    display: "inline-flex",
    minWidth: 0,
    alignItems: "baseline",
    gap: space.x2,
  },
  // A text link after the count; narrow screens clear from the Filters drawer.
  clear: {
    display: { default: "inline-flex", [PAGE_NARROW]: "none" },
    alignItems: "baseline",
    gap: space.x2,
  },
  clearButton: {
    padding: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
  countValue: {
    color: colors.ink,
    whiteSpace: "nowrap",
    fontFamily: fonts.display,
    fontSize: "20px",
    fontWeight: 700,
    letterSpacing: "-0.025em",
    lineHeight: 1.2,
  },
  countDetail: {
    color: colors.inkMuted,
    whiteSpace: "nowrap",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: space.x2,
    [COMPACT]: { maxWidth: "100%", flexWrap: "wrap" },
  },
  // Phones put the status after the controls so it never pushes them sideways.
  status: {
    minWidth: { default: "9ch", [COMPACT]: 0 },
    order: { default: 0, [COMPACT]: 1 },
  },
  loadingSelect: {
    display: "block",
    width: "128px",
    height: controlMetrics.controlHeightSmall,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
  },
  // Matches ListControls' "Filters" button.
  loadingFiltersButton: {
    display: "block",
    width: "92px",
    height: controlMetrics.controlHeightSmall,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  loadingIconButton: {
    display: "block",
    width: controlMetrics.controlHeightSmall,
    height: controlMetrics.controlHeightSmall,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
  },
  viewToggle: {
    display: "inline-flex",
    flexShrink: 0,
    gap: space.x1,
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
  statusWithMobileAction: {
    [PAGE_NARROW]: {
      minWidth: 0,
    },
  },
  wideSort: {
    display: "inline-flex",
    [PAGE_NARROW]: {
      display: "none",
    },
  },
  mobileAction: {
    display: "none",
    [PAGE_NARROW]: {
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
    borderWidth: 0,
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
