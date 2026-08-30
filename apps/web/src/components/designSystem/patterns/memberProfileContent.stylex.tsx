"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  colors,
  controlMetrics,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import {
  BottleIdentityRow,
  Button,
  Chip,
  CursorPager,
  EmptyState,
  FacetGroup,
  FilterQuery,
  RowMenu,
  TastingEntry,
  type BottleIdentityRowProps,
  type RowMenuGroup,
  type TastingEntryProps,
} from "../components";

const NARROW = "@media (max-width: 759px)";

export type MemberLibraryItem = BottleIdentityRowProps & {
  actions?: readonly RowMenuGroup[];
  id: string;
  status?: string;
};

export type MemberLibraryListProps = {
  emptyAction?: ReactNode;
  emptyDescription: ReactNode;
  emptyHeading: string;
  items: readonly MemberLibraryItem[];
  nextHref?: string;
  page: number;
  previousHref?: string;
  total?: number;
};

/** Presents one member Library page without personal-state marks that the view already implies. */
export function MemberLibraryList({
  emptyAction,
  emptyDescription,
  emptyHeading,
  items,
  nextHref,
  page,
  previousHref,
  total,
}: MemberLibraryListProps) {
  return (
    <section aria-label="Member library" {...stylex.props(styles.library)}>
      <div {...stylex.props(styles.libraryCount)}>
        <strong>
          {items.length.toLocaleString("en-US")}{" "}
          {items.length === 1 ? "bottle" : "bottles"}
        </strong>
        {total !== undefined ? (
          <span>of {total.toLocaleString("en-US")}</span>
        ) : null}
      </div>
      {items.length ? (
        <ul {...stylex.props(styles.libraryList)}>
          {items.map(({ actions, id, status, ...identity }) => (
            <li key={id} {...stylex.props(styles.libraryRow)}>
              <BottleIdentityRow
                {...identity}
                end={
                  status || actions?.length ? (
                    <div {...stylex.props(styles.libraryEnd)}>
                      {status ? <Chip>{status}</Chip> : null}
                      {actions?.length ? (
                        <RowMenu groups={actions} label={identity.name} />
                      ) : null}
                    </div>
                  ) : undefined
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState action={emptyAction} heading={emptyHeading}>
          {emptyDescription}
        </EmptyState>
      )}
      <CursorPager
        ariaLabel="Library pages"
        nextHref={nextHref}
        page={page}
        previousHref={previousHref}
      />
    </section>
  );
}

export type MemberLibraryFilter = {
  count?: number;
  label: string;
  selected: boolean;
  value: string;
};

export type MemberLibraryFilterGroup = {
  filters: readonly MemberLibraryFilter[];
  label: string;
  name: "brand" | "distiller" | "status";
};

export function MemberLibraryFilters({
  groups,
  mode,
  onChange,
  onClear,
  onQuerySubmit,
  query,
  total,
}: {
  groups: readonly MemberLibraryFilterGroup[];
  mode: "mobile" | "rail";
  onChange: (name: MemberLibraryFilterGroup["name"], value: string) => void;
  onClear: () => void;
  onQuerySubmit: (query: string) => void;
  query: string;
  total?: number;
}) {
  const hasFilters = Boolean(
    query ||
    groups.some((group) => group.filters.some((filter) => filter.selected)),
  );
  const content = (
    <div {...stylex.props(styles.filterContent)}>
      <FilterQuery
        label="Find in this library"
        onSubmit={onQuerySubmit}
        placeholder="Bottle or brand"
        query={query}
        submitLabel="Find"
      />
      {groups.map((group) => (
        <FacetGroup
          key={group.name}
          label={group.label}
          onChange={(value) => onChange(group.name, value)}
          options={group.filters}
          selected={group.filters.find((filter) => filter.selected)?.value}
          total={total}
        />
      ))}
      {hasFilters ? (
        <Button onClick={onClear} size="sm" variant="text">
          Clear filters
        </Button>
      ) : null}
    </div>
  );

  return mode === "mobile" ? (
    <details {...stylex.props(styles.mobileFilters)}>
      <summary {...stylex.props(styles.mobileSummary)}>Filter library</summary>
      {content}
    </details>
  ) : (
    <div {...stylex.props(styles.railFilters)}>{content}</div>
  );
}

export type MemberCollectionActivity = {
  author: string;
  authorHref: string;
  collectionHref?: string;
  collectionName: string;
  date: ReactNode;
  id: string;
  items: readonly (BottleIdentityRowProps & { id: string })[];
  totalItems: number;
};

export type MemberActivityItem =
  | { id: string; kind: "tasting"; tasting: TastingEntryProps }
  | { activity: MemberCollectionActivity; id: string; kind: "collection" };

export function MemberActivityList({
  emptyDescription,
  items,
}: {
  emptyDescription: ReactNode;
  items: readonly MemberActivityItem[];
}) {
  if (!items.length) {
    return (
      <EmptyState heading="No activity yet">{emptyDescription}</EmptyState>
    );
  }

  return (
    <div aria-label="Member activity" {...stylex.props(styles.activityList)}>
      {items.map((item) =>
        item.kind === "tasting" ? (
          <TastingEntry key={item.id} {...item.tasting} />
        ) : (
          <CollectionActivity key={item.id} activity={item.activity} />
        ),
      )}
    </div>
  );
}

function CollectionActivity({
  activity,
}: {
  activity: MemberCollectionActivity;
}) {
  const hiddenCount = Math.max(0, activity.totalItems - activity.items.length);
  return (
    <article {...stylex.props(styles.collectionActivity)}>
      <header {...stylex.props(styles.activityHeader)}>
        <div {...stylex.props(styles.activityCopy)}>
          <div {...stylex.props(styles.activitySentence)}>
            <a href={activity.authorHref}>{activity.author}</a>
            <span> added {formatBottleCount(activity.totalItems)} to </span>
            {activity.collectionHref ? (
              <a href={activity.collectionHref}>{activity.collectionName}</a>
            ) : (
              <strong>{activity.collectionName}</strong>
            )}
          </div>
          <span {...stylex.props(styles.activityDate)}>{activity.date}</span>
        </div>
      </header>
      {activity.items.length ? (
        <ul {...stylex.props(styles.collectionItems)}>
          {activity.items.map(({ id, ...identity }) => (
            <li key={id} {...stylex.props(styles.collectionItem)}>
              <BottleIdentityRow {...identity} />
            </li>
          ))}
          {hiddenCount ? (
            <li {...stylex.props(styles.moreItems)}>
              +{hiddenCount.toLocaleString("en-US")} more
            </li>
          ) : null}
        </ul>
      ) : null}
    </article>
  );
}

function formatBottleCount(count: number) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "bottle" : "bottles"}`;
}

const styles = stylex.create({
  library: { minWidth: 0 },
  libraryCount: {
    display: "flex",
    alignItems: "baseline",
    gap: space.x2,
    paddingBottom: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "17px",
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  libraryList: { margin: 0, padding: 0, listStyle: "none" },
  libraryRow: {
    paddingTop: "14px",
    paddingBottom: "14px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  libraryEnd: { display: "flex", alignItems: "center", gap: space.x2 },
  filterContent: { display: "flex", flexDirection: "column", gap: space.x6 },
  railFilters: { display: "block", [NARROW]: { display: "none" } },
  mobileFilters: {
    display: "none",
    marginBottom: space.x6,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
    [NARROW]: { display: "block" },
  },
  mobileSummary: {
    padding: space.x3,
    color: colors.ink,
    fontFamily: fonts.reading,
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  activityList: { display: "flex", minWidth: 0, flexDirection: "column" },
  collectionActivity: {
    paddingTop: space.x4,
    paddingBottom: space.x4,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  activityHeader: { display: "flex", minWidth: 0 },
  activityCopy: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
  },
  activitySentence: {
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
  },
  activityDate: {
    marginTop: "2px",
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    lineHeight: 1.35,
  },
  collectionItems: {
    margin: 0,
    marginTop: space.x3,
    paddingRight: space.x4,
    paddingLeft: space.x4,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.surface,
    listStyle: "none",
  },
  collectionItem: {
    paddingTop: space.x3,
    paddingBottom: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  moreItems: {
    paddingTop: space.x2,
    paddingBottom: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
  },
});
