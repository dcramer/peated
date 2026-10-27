"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import type { PagingRel } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";
import { ArrowDown, ArrowUp } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactElement } from "react";

import { buildQueryString } from "../../lib/urls";
import {
  colors,
  controlMetrics,
  effects,
  space,
} from "../../styles/tokens.stylex";
import { AppLink } from "../appLink";
import { LoadingPlaceholder } from "../feedback.stylex";
import { TextInput } from "../field.stylex";
import { LinkPending } from "../linkPending.stylex";
import { Table, type TableColumn } from "../table.stylex";
import { AdminPager } from "./adminUtility.stylex";

export type AdminTableColumn<Item extends object> = {
  align?: "center" | "left" | "right";
  hidden?: boolean;
  name: string;
  /** Keeps a column after the first on narrow screens. */
  showOnMobile?: boolean;
  sort?: string;
  sortDefaultOrder?: "asc" | "desc";
  title?: string;
  value?: (item: Item) => ReactElement | string | null | false;
};

export type AdminTableProps<Item extends object> = {
  caption: string;
  columns: AdminTableColumn<Item>[];
  defaultSort?: string;
  items: Item[];
  primaryKey?: (item: Item) => string;
  rel?: PagingRel;
  searchParams?: URLSearchParams;
  url?: (item: Item) => string | null;
  withSearch?: boolean;
};

/**
 * Administrator records in the shared Table, with optional search, sortable
 * headers kept in the URL, and paging. Columns read `name` from each item
 * unless they supply `value`. Columns after the first hide on narrow screens
 * unless they set showOnMobile.
 */
export function AdminTable<Item extends object>({
  caption,
  columns,
  defaultSort,
  items,
  primaryKey = defaultPrimaryKey,
  rel,
  searchParams: searchParamsProp,
  url,
  withSearch = false,
}: AdminTableProps<Item>) {
  const pathname = usePathname();
  const navigationParams = useSearchParams();
  const searchParams =
    searchParamsProp ?? navigationParams ?? new URLSearchParams();
  const currentSort = searchParams.get("sort") ?? defaultSort;
  const tableColumns = columns
    .filter((column) => !column.hidden)
    .map((column, index): TableColumn<Item> => {
      const label = column.title ?? toTitleCase(column.name);
      return {
        align: column.align,
        cell: (item) => getColumnValue(item, column),
        header: column.sort ? (
          <SortLink
            defaultOrder={column.sortDefaultOrder}
            label={label}
            name={column.sort}
            sort={currentSort}
          />
        ) : (
          label
        ),
        key: column.name,
        priority: index > 0 && !column.showOnMobile ? "secondary" : "primary",
      };
    });

  return (
    <div {...stylex.props(styles.root)}>
      {withSearch ? (
        <form action={pathname} {...stylex.props(styles.searchForm)}>
          <TextInput
            aria-label="Search"
            controlSize="md"
            defaultValue={searchParams.get("query") ?? ""}
            name="query"
            placeholder="Search"
            type="search"
          />
        </form>
      ) : null}
      {items.length ? (
        <Table
          caption={caption}
          columns={tableColumns}
          getHref={url}
          getKey={primaryKey}
          items={items}
        />
      ) : null}
      <AdminPager rel={rel} searchParams={searchParams} />
    </div>
  );
}

const loadingDelays = [0, 1, 2, 3, 4] as const;

/** Reserves the shared administrator table structure while its rows load. */
export function AdminTableLoading({
  columns = 2,
  label = "Loading records",
  rows = 5,
  withSearch = false,
}: {
  columns?: 1 | 2 | 3 | 4;
  label?: string;
  rows?: 3 | 4 | 5 | 6;
  withSearch?: boolean;
}) {
  const loadingColumns = Array.from(
    { length: columns },
    (_, columnIndex): TableColumn<number> => ({
      cell: (rowIndex) => (
        <LoadingPlaceholder
          delay={loadingDelays[(rowIndex + columnIndex) % loadingDelays.length]}
          preset={columnIndex === 0 ? "text" : "metadata"}
        />
      ),
      header: (
        <LoadingPlaceholder
          delay={loadingDelays[columnIndex]}
          preset="metadata"
        />
      ),
      key: String(columnIndex),
      priority: columnIndex > 0 ? "secondary" : "primary",
    }),
  );

  return (
    <div
      aria-busy="true"
      aria-label={label}
      role="status"
      {...stylex.props(styles.root)}
    >
      {withSearch ? (
        <div aria-hidden="true" {...stylex.props(styles.loadingSearch)} />
      ) : null}
      <div aria-hidden="true">
        <Table
          caption={label}
          columns={loadingColumns}
          getKey={(rowIndex) => rowIndex}
          items={Array.from({ length: rows }, (_, rowIndex) => rowIndex)}
        />
      </div>
    </div>
  );
}

function SortLink({
  defaultOrder = "asc",
  label,
  name,
  sort,
}: {
  defaultOrder?: "asc" | "desc";
  label: string;
  name: string;
  sort?: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inverted = `-${name}`;
  const nextSort =
    sort === name
      ? inverted
      : sort === inverted
        ? name
        : defaultOrder === "asc"
          ? name
          : inverted;
  const search = buildQueryString(searchParams, { sort: nextSort });
  return (
    <AppLink
      href={`${pathname}?${search}`}
      prefetch={null}
      {...stylex.props(styles.sortLink)}
    >
      {label}
      <LinkPending />
      {sort === name ? <ArrowDown aria-hidden="true" size={12} /> : null}
      {sort === inverted ? <ArrowUp aria-hidden="true" size={12} /> : null}
    </AppLink>
  );
}

function defaultPrimaryKey<Item extends object>(item: Item): string {
  const id = Object.entries(item).find(([name]) => name === "id")?.[1];
  return String(id);
}

function getColumnValue<Item extends object>(
  item: Item,
  column: AdminTableColumn<Item>,
) {
  if (column.value) return column.value(item);
  return String(
    Object.entries(item).find(([name]) => name === column.name)?.[1] ?? "",
  );
}

const styles = stylex.create({
  root: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    rowGap: space.x3,
  },
  searchForm: { display: "flex", alignItems: "center" },
  loadingSearch: {
    width: "100%",
    height: controlMetrics.controlHeight,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
  },
  sortLink: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    gap: space.x1,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: { default: colors.inkMuted, ":hover": colors.accentDeep },
    textDecoration: "none",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
  },
});
