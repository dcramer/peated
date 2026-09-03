"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  CommunityFeedEntry,
  type CommunityFeedItem,
} from "../communityFeed.stylex";

import {
  BottleIdentityRow,
  Button,
  Chip,
  CursorPager,
  EmptyState,
  FacetGroup,
  FilterQuery,
  ItemList,
  ItemListItem,
  ListToolbar,
  RowMenu,
  TastingEntry,
  TextLink,
  type BottleIdentityRowProps,
  type ListSortOption,
  type RowMenuGroup,
  type TastingEntryProps,
} from "..";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, effects, space } from "../../styles/tokens.stylex";

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
  onSortChange: (value: string) => void;
  pending?: boolean;
  page: number;
  previousHref?: string;
  sort: string;
  sortOptions: readonly [ListSortOption, ...ListSortOption[]];
  total?: number;
};

/** Presents one member Library page without personal-state marks that the view already implies. */
export function MemberLibraryList({
  emptyAction,
  emptyDescription,
  emptyHeading,
  items,
  nextHref,
  onSortChange,
  pending = false,
  page,
  previousHref,
  sort,
  sortOptions,
  total,
}: MemberLibraryListProps) {
  return (
    <section aria-label="Member library" {...stylex.props(styles.library)}>
      <ListToolbar
        count={items.length}
        noun="bottle"
        onSortChange={onSortChange}
        pending={pending}
        sort={sort}
        sortOptions={sortOptions}
        total={total}
      />
      <div aria-busy={pending || undefined}>
        {items.length ? (
          <ItemList ariaLabel="Library bottles">
            {items.map(({ actions, id, status, ...identity }) => (
              <ItemListItem key={id}>
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
              </ItemListItem>
            ))}
          </ItemList>
        ) : (
          <EmptyState action={emptyAction} heading={emptyHeading}>
            {emptyDescription}
          </EmptyState>
        )}
      </div>
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
      <summary
        {...stylex.props(
          foundationStyles.interactiveSmall,
          styles.mobileSummary,
        )}
      >
        Filter library
      </summary>
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
  | { id: string; kind: "review"; review: CommunityFeedItem }
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
    <ItemList ariaLabel="Member activity">
      {items.map((item) =>
        item.kind === "review" ? (
          <ItemListItem key={item.id}>
            <CommunityFeedEntry item={item.review} />
          </ItemListItem>
        ) : item.kind === "tasting" ? (
          <ItemListItem key={item.id}>
            <TastingEntry {...item.tasting} />
          </ItemListItem>
        ) : (
          <ItemListItem key={item.id}>
            <CollectionActivity activity={item.activity} />
          </ItemListItem>
        ),
      )}
    </ItemList>
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
          <div
            {...stylex.props(
              foundationStyles.metadata,
              styles.activitySentence,
            )}
          >
            <TextLink href={activity.authorHref} size="inherit">
              {activity.author}
            </TextLink>
            <span> added {formatBottleCount(activity.totalItems)} to </span>
            {activity.collectionHref ? (
              <TextLink href={activity.collectionHref} size="inherit">
                {activity.collectionName}
              </TextLink>
            ) : (
              <strong>{activity.collectionName}</strong>
            )}
          </div>
          <span
            {...stylex.props(foundationStyles.metadata, styles.activityDate)}
          >
            {activity.date}
          </span>
        </div>
      </header>
      {activity.items.length ? (
        <div {...stylex.props(styles.collectionItems)}>
          <ItemList ariaLabel={`${activity.collectionName} additions`}>
            {activity.items.map(({ id, ...identity }) => (
              <ItemListItem key={id}>
                <BottleIdentityRow {...identity} variant="compact" />
              </ItemListItem>
            ))}
            {hiddenCount ? (
              <ItemListItem>
                <div
                  {...stylex.props(foundationStyles.metadata, styles.moreItems)}
                >
                  +{hiddenCount.toLocaleString("en-US")} more
                </div>
              </ItemListItem>
            ) : null}
          </ItemList>
        </div>
      ) : null}
    </article>
  );
}

function formatBottleCount(count: number) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "bottle" : "bottles"}`;
}

const styles = stylex.create({
  library: { minWidth: 0 },
  libraryEnd: { display: "flex", alignItems: "center", gap: space.x2 },
  filterContent: { display: "flex", flexDirection: "column", gap: space.x6 },
  railFilters: { display: "block", [NARROW]: { display: "none" } },
  mobileFilters: {
    display: "none",
    marginBottom: space.x6,
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.sectionRule,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    backgroundColor: "transparent",
    [NARROW]: { display: "block" },
  },
  mobileSummary: {
    padding: space.x3,
    color: colors.ink,
    fontWeight: 600,
    cursor: "pointer",
    outline: "none",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  collectionActivity: {
    paddingTop: space.x4,
    paddingBottom: space.x4,
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
  },
  activityDate: {
    marginTop: "2px",
    color: colors.inkMuted,
  },
  collectionItems: {
    marginTop: space.x3,
  },
  moreItems: {
    paddingTop: space.x2,
    paddingRight: "18px",
    paddingBottom: space.x2,
    paddingLeft: "18px",
    color: colors.inkMuted,
  },
});
