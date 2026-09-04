"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  Button,
  ButtonLink,
  CursorPager,
  EmptyState,
  EntityIdentityRow,
  FacetGroup,
  FilterPanel,
  ListToolbar,
  RowMenu,
  type EntityListItem,
  type ListSortOption,
  type RowMenuItem,
} from "..";
import { CatalogTable, type CatalogTableColumn } from "../catalogTable.stylex";
import { CatalogPageLoading } from "./catalogPage.stylex";

export type EntityCatalogItem = EntityListItem & {
  createBottleHref?: string;
  id: number;
  isFollowing: boolean;
  ownerPath?: string;
  totalBottles: number;
  totalTastings: number;
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
  addHref?: string;
  emptyAction?: ReactNode;
  emptyDescription?: ReactNode;
  emptyHeading?: string;
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
  showFollowingMarks?: boolean;
  sort: string;
  sortOptions: readonly [ListSortOption, ...ListSortOption[]];
  total: number;
};

/** Presents one API-owned cursor page and its full-result total. */
export function EntityCatalogList({
  addHref,
  emptyAction,
  emptyDescription = "Try a broader search or remove the current location filter.",
  emptyHeading,
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
  showFollowingMarks = true,
  sort,
  sortOptions,
  total,
}: EntityCatalogListProps) {
  return (
    <section aria-label={`${noun} catalog`} {...stylex.props(styles.catalog)}>
      <ListToolbar
        count={items.length}
        noun={noun}
        onSortChange={onSortChange}
        pending={pending}
        sort={sort}
        sortOptions={sortOptions}
        total={total}
      />
      <div aria-busy={pending || undefined}>
        {items.length ? (
          <EntityCatalogTable
            items={items}
            noun={noun}
            onToggleFollowing={onToggleFollowing}
            pendingIds={pendingIds}
            showFollowingMarks={showFollowingMarks}
          />
        ) : (
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
        )}
      </div>
      <CursorPager
        ariaLabel={`${noun} pages`}
        nextHref={nextHref}
        page={page}
        previousHref={previousHref}
      />
    </section>
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
  const columns: CatalogTableColumn<EntityCatalogItem>[] = [
    {
      cell: (item) => (
        <EntityIdentityRow
          href={item.href}
          name={item.name}
          kind={item.kind}
          location={item.location}
          isFollowing={item.isFollowing && showFollowingMarks}
          layout="cell"
        />
      ),
      padding: "flush",
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
      cell: (item) => item.totalTastings.toLocaleString("en-US"),
      header: "Tastings",
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

        return groups.length ? (
          <RowMenu groups={groups} label={item.name} triggerVariant="text" />
        ) : null;
      },
      header: <span {...stylex.props(styles.visuallyHidden)}>Actions</span>,
      interactive: true,
      key: "actions",
      width: "menu",
    });
  }

  return (
    <CatalogTable
      caption={`${noun} records`}
      columns={columns}
      getKey={(item) => item.id}
      items={items}
      linked
    />
  );
}

export type EntityCatalogCountry = {
  label: string;
  value: string;
};

export type EntityCatalogFiltersProps = {
  ariaLabel: string;
  countries: readonly EntityCatalogCountry[];
  country: string;
  onClear: () => void;
  onCountryChange: (value: string) => void;
  onQuerySubmit: (value: string) => void;
  onRegionClear?: () => void;
  query: string;
  region?: string;
};

/** Keeps query and location filters reachable while the route owns URL state. */
export function EntityCatalogFilters({
  ariaLabel,
  countries,
  country,
  onClear,
  onCountryChange,
  onQuerySubmit,
  onRegionClear,
  query,
  region,
}: EntityCatalogFiltersProps) {
  return (
    <FilterPanel
      ariaLabel={ariaLabel}
      onClear={query || country || region ? onClear : undefined}
      query={{
        label: "Find a record",
        onSubmit: onQuerySubmit,
        placeholder: "Name",
        query,
      }}
    >
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
    </FilterPanel>
  );
}

export function EntityCatalogLoading({ title }: { title: string }) {
  return <CatalogPageLoading title={title} />;
}

const styles = stylex.create({
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
  catalog: {
    minWidth: 0,
  },
});
