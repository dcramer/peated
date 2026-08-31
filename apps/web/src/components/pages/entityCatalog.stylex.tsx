"use client";

import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import {
  Button,
  ButtonLink,
  CursorPager,
  EmptyState,
  FacetGroup,
  FilterPanel,
  FilterQuery,
  ListToolbar,
  MemberStatus,
  type ListSortOption,
} from "..";
import { colors, fonts, space } from "../../styles/tokens.stylex";
import { AppLink } from "../appLink";
import { linkedRowStyles } from "../linkedRow.stylex";
import { CatalogPageLoading } from "./catalogPage.stylex";
import { CatalogTable, type CatalogTableColumn } from "./catalogTable.stylex";

export type EntityCatalogItem = {
  href: string;
  id: number;
  isFollowing: boolean;
  metadata: readonly string[];
  name: string;
  totalBottles: number;
  totalTastings: number;
};

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
  pendingId?: number;
  previousHref?: string;
  showFollowingMarks?: boolean;
  sort: string;
  sortOptions: readonly [ListSortOption, ...ListSortOption[]];
};

/** Presents one API-owned cursor page without inventing a total. */
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
  pendingId,
  previousHref,
  showFollowingMarks = true,
  sort,
  sortOptions,
}: EntityCatalogListProps) {
  return (
    <section aria-label={`${noun} catalog`} {...stylex.props(styles.catalog)}>
      <ListToolbar
        count={items.length}
        noun={noun}
        onSortChange={onSortChange}
        sort={sort}
        sortOptions={sortOptions}
      />
      {items.length ? (
        <EntityCatalogTable
          items={items}
          noun={noun}
          onToggleFollowing={onToggleFollowing}
          pendingId={pendingId}
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
  pendingId,
  showFollowingMarks,
}: {
  items: readonly EntityCatalogItem[];
  noun: string;
  onToggleFollowing?: (item: EntityCatalogItem) => void;
  pendingId?: number;
  showFollowingMarks: boolean;
}) {
  const columns: CatalogTableColumn<EntityCatalogItem>[] = [
    {
      cell: (item) => (
        <>
          <AppLink
            href={item.href}
            {...stylex.props(styles.title, linkedRowStyles.primaryLink)}
          >
            {item.name}
            {item.isFollowing && showFollowingMarks ? (
              <MemberStatus kind="following" />
            ) : null}
          </AppLink>
          <div {...stylex.props(styles.metadata)}>
            {item.metadata.join(" · ")}
          </div>
        </>
      ),
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

  if (onToggleFollowing) {
    columns.push({
      align: "right",
      cell: (item) => (
        <Button
          aria-label={
            item.isFollowing ? `Unfollow ${item.name}` : `Follow ${item.name}`
          }
          aria-pressed={item.isFollowing}
          loading={pendingId === item.id}
          loadingLabel={item.isFollowing ? "Unfollowing…" : "Following…"}
          onClick={() => onToggleFollowing(item)}
          size="sm"
          variant={item.isFollowing ? "text" : "tonal"}
        >
          {item.isFollowing ? "Following" : "Follow"}
        </Button>
      ),
      header: "Follow",
      interactive: true,
      key: "follow",
      width: "action",
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
    <FilterPanel ariaLabel={ariaLabel}>
      <FilterQuery
        label="Find a record"
        onSubmit={onQuerySubmit}
        placeholder="Name"
        query={query}
      />
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
      <Button align="start" onClick={onClear} size="sm" variant="text">
        Clear filters
      </Button>
    </FilterPanel>
  );
}

export function EntityCatalogLoading({ title }: { title: string }) {
  return <CatalogPageLoading title={title} />;
}

const styles = stylex.create({
  catalog: {
    minWidth: 0,
  },
  title: {
    display: "block",
    overflow: "hidden",
    color: colors.ink,
    fontFamily: fonts.display,
    fontSize: "18px",
    fontWeight: 700,
    letterSpacing: "-0.025em",
    lineHeight: 1.25,
    textDecoration: "none",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  metadata: {
    marginTop: "3px",
    overflow: "hidden",
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.4,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
