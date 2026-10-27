"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  Button,
  ButtonLink,
  IconButton,
} from "@peated/web/components/button.stylex";
import {
  EntityIdentityRow,
  type EntityListItem,
} from "@peated/web/components/entityIdentityRow.stylex";
import { EmptyState } from "@peated/web/components/feedback.stylex";
import {
  FacetGroup,
  type FilterQueryProps,
} from "@peated/web/components/filterPanel.stylex";
import { type ListSortOption } from "@peated/web/components/lists.stylex";
import {
  RowMenu,
  type RowMenuItem,
} from "@peated/web/components/rowMenu.stylex";
import { breakpointStyles } from "../../styles/foundations.stylex";
import { CatalogResultsLayout } from "../catalogResultsLayout.stylex";
import { Table, type TableColumn } from "../table.stylex";
import { CatalogPageLoading } from "./catalogPage.stylex";

export type EntityCatalogItem = EntityListItem & {
  createBottleHref?: string;
  id: number;
  isFollowing: boolean;
  ownerPath?: string;
  totalBottles: number;
  publicReviewAndTastingCount: number;
};

export function getEntityRowActionGroups({
  item,
  onToggleFollowing,
  pendingIds,
}: {
  item: EntityCatalogItem;
  onToggleFollowing?: (item: EntityCatalogItem) => void;
  pendingIds?: ReadonlySet<number>;
}): RowMenuItem[][] {
  const groups: RowMenuItem[][] = [];

  if (item.createBottleHref) {
    groups.push([{ href: item.createBottleHref, label: "Add a bottle" }]);
  }

  if (onToggleFollowing) {
    const pending = pendingIds?.has(item.id) ?? false;

    groups.push([
      {
        disabled: pending,
        label: pending
          ? item.isFollowing
            ? "Unfollowing…"
            : "Following…"
          : item.isFollowing
            ? "Unfollow"
            : "Follow",
        onSelect: () => onToggleFollowing(item),
      },
    ]);
  }

  return groups;
}

export type EntityCatalogListProps = {
  activeFilterCount?: number;
  addHref?: string;
  emptyAction?: ReactNode;
  emptyDescription?: ReactNode;
  emptyHeading?: string;
  filters?: ReactNode;
  items: readonly EntityCatalogItem[];
  nextHref?: string;
  noun: string;
  onClear?: () => void;
  onToggleFollowing?: (item: EntityCatalogItem) => void;
  onSortChange: (value: string) => void;
  page: number;
  pending?: boolean;
  pendingIds?: ReadonlySet<number>;
  previousHref?: string;
  query?: FilterQueryProps;
  showFollowingMarks?: boolean;
  sort: string;
  sortOptions: readonly [ListSortOption, ...ListSortOption[]];
  total: number;
};

/** Presents one API-owned cursor page and its full-result total. */
export function EntityCatalogList({
  activeFilterCount = 0,
  addHref,
  emptyAction,
  emptyDescription = "Try a broader search or remove the current location filter.",
  emptyHeading,
  filters,
  items,
  nextHref,
  noun,
  onClear,
  onToggleFollowing,
  onSortChange,
  page,
  pending = false,
  pendingIds,
  previousHref,
  query,
  showFollowingMarks = true,
  sort,
  sortOptions,
  total,
}: EntityCatalogListProps) {
  return (
    <CatalogResultsLayout
      activeFilterCount={activeFilterCount}
      ariaLabel={`${noun} catalog`}
      count={items.length}
      empty={
        <EmptyState
          action={
            emptyAction ??
            (onClear ? (
              <Button onClick={onClear} size="sm" variant="tonal">
                Clear filters
              </Button>
            ) : addHref ? (
              <ButtonLink href={addHref} size="sm" variant="tonal">
                Add {noun}
              </ButtonLink>
            ) : undefined)
          }
          heading={emptyHeading ?? `No ${noun}s found`}
        >
          {emptyDescription}
        </EmptyState>
      }
      filters={filters}
      nextHref={nextHref}
      noun={noun}
      onClear={onClear}
      onSortChange={onSortChange}
      page={page}
      pending={pending}
      previousHref={previousHref}
      query={query}
      sort={sort}
      sortOptions={sortOptions}
      total={total}
    >
      <EntityCatalogTable
        items={items}
        noun={noun}
        onToggleFollowing={onToggleFollowing}
        pendingIds={pendingIds}
        showFollowingMarks={showFollowingMarks}
      />
    </CatalogResultsLayout>
  );
}

function EntityCatalogTable({
  items,
  noun,
  onToggleFollowing,
  pendingIds,
  showFollowingMarks,
}: {
  items: readonly EntityCatalogItem[];
  noun: string;
  onToggleFollowing?: (item: EntityCatalogItem) => void;
  pendingIds?: ReadonlySet<number>;
  showFollowingMarks: boolean;
}) {
  const columns: TableColumn<EntityCatalogItem>[] = [
    {
      cell: (item) => (
        <EntityIdentityRow
          href={item.href}
          name={item.name}
          kind={item.kind}
          location={item.location}
          followingMark={onToggleFollowing ? "narrow" : "always"}
          isFollowing={item.isFollowing && showFollowingMarks}
          layout="cell"
        />
      ),
      verticalPadding: "none",
      header: "Name",
      key: "name",
    },
    {
      align: "right",
      cell: (item) => item.totalBottles.toLocaleString("en-US"),
      header: "Bottles",
      key: "bottles",
      width: "count",
    },
    {
      align: "right",
      cell: (item) => item.publicReviewAndTastingCount.toLocaleString("en-US"),
      header: "Reviews",
      key: "tastings",
      priority: "secondary",
      width: "count",
    },
  ];

  if (items.some((item) => item.ownerPath)) {
    columns.splice(1, 0, {
      cell: (item) => item.ownerPath ?? "",
      header: "Part of",
      key: "owner",
      priority: "secondary",
    });
  }

  if (onToggleFollowing || items.some((item) => item.createBottleHref)) {
    columns.push({
      align: "right",
      cell: (item) => {
        const groups = getEntityRowActionGroups({
          item,
          onToggleFollowing,
          pendingIds,
        });

        return (
          <div {...stylex.props(styles.actions)}>
            {onToggleFollowing ? (
              <EntityFollowToggle
                item={item}
                onToggle={onToggleFollowing}
                pending={pendingIds?.has(item.id) ?? false}
              />
            ) : null}
            {groups.length ? (
              <RowMenu
                groups={groups}
                label={item.name}
                triggerVariant="quiet"
              />
            ) : null}
          </div>
        );
      },
      header: <span {...stylex.props(styles.visuallyHidden)}>Actions</span>,
      interactive: true,
      key: "actions",
      width: onToggleFollowing ? "toggleMenu" : "menu",
    });
  }

  return (
    <Table
      caption={`${noun} records`}
      columns={columns}
      getKey={(item) => item.id}
      items={items}
      linked
    />
  );
}

/**
 * Wide tables show follow as a one-click toggle. Narrow tables hide it to save
 * room; the row menu keeps Follow and Unfollow there.
 */
function EntityFollowToggle({
  item,
  onToggle,
  pending,
}: {
  item: EntityCatalogItem;
  onToggle: (item: EntityCatalogItem) => void;
  pending: boolean;
}) {
  const label = `${item.isFollowing ? "Unfollow" : "Follow"} ${item.name}`;

  return (
    <span {...stylex.props(breakpointStyles.wideOnly)}>
      <IconButton
        aria-pressed={item.isFollowing}
        icon={<FollowEye following={item.isFollowing} />}
        label={label}
        loading={pending}
        onClick={() => onToggle(item)}
        size="sm"
        title={label}
        variant="quiet"
      />
    </span>
  );
}

/** The Following mark's eye: outlined to follow, filled when followed. */
function FollowEye({ following }: { following: boolean }) {
  const outline =
    "M1.6 8s2.2-3.5 6.4-3.5S14.4 8 14.4 8 12.2 11.5 8 11.5 1.6 8 1.6 8Z";

  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="18"
      viewBox="0 0 16 16"
      width="18"
    >
      {following ? (
        <path
          clipRule="evenodd"
          d={`${outline}M8 9.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z`}
          fill="currentColor"
          fillRule="evenodd"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.2"
        />
      ) : (
        <>
          <path
            d={outline}
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.3"
          />
          <circle
            cx="8"
            cy="8"
            r="1.6"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        </>
      )}
    </svg>
  );
}

export type EntityCatalogCountry = {
  label: string;
  value: string;
};

export type EntityCatalogFacetsProps = {
  countries: readonly EntityCatalogCountry[];
  country: string;
  onCountryChange: (value: string) => void;
  onRegionClear?: () => void;
  region?: string;
};

export function EntityCatalogFacets({
  countries,
  country,
  onCountryChange,
  onRegionClear,
  region,
}: EntityCatalogFacetsProps) {
  return (
    <>
      <FacetGroup
        label="Country"
        onChange={onCountryChange}
        options={countries}
        selected={country}
      />
      {region && onRegionClear ? (
        <FacetGroup
          label="Region"
          onChange={onRegionClear}
          options={[{ label: region, value: region }]}
          selected={region}
        />
      ) : null}
    </>
  );
}

export function EntityCatalogLoading({ title }: { title: string }) {
  return <CatalogPageLoading title={title} variant="entity" />;
}

const styles = stylex.create({
  actions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "2px",
  },
  visuallyHidden: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
});
