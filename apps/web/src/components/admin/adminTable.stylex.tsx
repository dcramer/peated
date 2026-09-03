"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import type { PagingRel } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactElement, ReactNode } from "react";

import { buildQueryString } from "../../lib/urls";
import { foundationStyles } from "../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  space,
} from "../../styles/tokens.stylex";
import { linkedRowStyles } from "../linkedRow.stylex";
import { AdminPager } from "./adminUtility.stylex";

export type AdminTableColumn<Item extends object> = {
  align?: "center" | "default" | "left" | "right";
  fill?: boolean;
  hidden?: boolean;
  name: string;
  sort?: string;
  sortDefaultOrder?: "asc" | "desc";
  title?: string;
  value?: (item: Item) => ReactElement | string | null | false;
};

type Group = { id: number | string; name: string };

export type AdminTableProps<Item extends object, ItemGroup extends Group> = {
  columns: AdminTableColumn<Item>[];
  defaultSort?: string;
  groupBy?: (item: Item) => ItemGroup;
  groupItem?: (item: ItemGroup) => ReactNode;
  groupTo?: (group: ItemGroup) => string;
  items: Item[];
  noHeaders?: boolean;
  primaryKey?: (item: Item) => string;
  rel?: PagingRel;
  searchParams?: URLSearchParams;
  url?: (item: Item) => string | null;
  withSearch?: boolean;
};

export function AdminTable<
  Item extends object,
  ItemGroup extends Group = Group,
>(props: AdminTableProps<Item, ItemGroup>) {
  const navigationParams = useSearchParams();
  return (
    <AdminTableContent
      {...props}
      searchParams={
        props.searchParams ?? navigationParams ?? new URLSearchParams()
      }
    />
  );
}

export function AdminTableContent<
  Item extends object,
  ItemGroup extends Group = Group,
>({
  columns,
  defaultSort,
  groupBy,
  groupItem = (item) => item.name,
  groupTo,
  items,
  noHeaders = false,
  primaryKey = defaultPrimaryKey,
  rel,
  searchParams,
  url = () => null,
  withSearch = false,
}: AdminTableProps<Item, ItemGroup> & { searchParams: URLSearchParams }) {
  const pathname = usePathname();
  const currentSort = searchParams.get("sort") ?? defaultSort;

  return (
    <div {...stylex.props(styles.root)}>
      {withSearch ? (
        <form action={pathname} {...stylex.props(styles.searchForm)}>
          <Search
            aria-hidden="true"
            size={16}
            {...stylex.props(styles.searchIcon)}
          />
          <input
            aria-label="Search"
            defaultValue={searchParams.get("query") ?? ""}
            name="query"
            placeholder="Search"
            type="search"
            {...stylex.props(foundationStyles.input, styles.searchInput)}
          />
        </form>
      ) : null}
      <div {...stylex.props(styles.frame)}>
        <table {...stylex.props(styles.table)}>
          {!noHeaders ? (
            <thead>
              <tr {...stylex.props(styles.headerRow)}>
                {columns.map((column, index) => {
                  if (column.hidden) return null;
                  const align = resolveAlignment(column.align, index);
                  const label = column.title ?? toTitleCase(column.name);
                  return (
                    <th
                      key={column.name}
                      scope="col"
                      {...stylex.props(
                        foundationStyles.fieldLabel,
                        styles.header,
                        alignStyles[align],
                        index > 0 && styles.secondary,
                      )}
                    >
                      {column.sort ? (
                        <SortLink
                          defaultOrder={column.sortDefaultOrder}
                          label={label}
                          name={column.sort}
                          sort={currentSort}
                        />
                      ) : (
                        label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {items.map((item, itemIndex) => {
              const itemKey = primaryKey(item);
              const itemHref = url(item);
              const group = groupBy?.(item);
              const previousGroup =
                itemIndex > 0 ? groupBy?.(items[itemIndex - 1]!) : undefined;
              const showGroup = group && group.id !== previousGroup?.id;

              return [
                showGroup ? (
                  <tr
                    key={`group-${group.id}`}
                    {...stylex.props(styles.groupRow)}
                  >
                    <th
                      colSpan={columns.length}
                      scope="colgroup"
                      {...stylex.props(
                        foundationStyles.metadata,
                        styles.groupCell,
                      )}
                    >
                      {groupTo ? (
                        <Link
                          href={groupTo(group)}
                          {...stylex.props(styles.groupLink)}
                        >
                          {groupItem(group)}
                        </Link>
                      ) : (
                        group.name
                      )}
                    </th>
                  </tr>
                ) : null,
                <tr
                  data-record-key={itemKey}
                  key={itemKey}
                  {...stylex.props(
                    styles.row,
                    Boolean(itemHref) && linkedRowStyles.container,
                    Boolean(itemHref) && linkedRowStyles.onSurface,
                  )}
                >
                  {columns.map((column, index) => {
                    if (column.hidden) return null;
                    const align = resolveAlignment(column.align, index);
                    return (
                      <td
                        key={column.name}
                        {...stylex.props(
                          foundationStyles.metadata,
                          styles.cell,
                          alignStyles[align],
                          column.fill && styles.fill,
                          index > 0 && styles.secondary,
                        )}
                      >
                        {index === 0 && itemHref ? (
                          <Link
                            aria-label={`Open ${itemKey}`}
                            href={itemHref}
                            {...stylex.props(linkedRowStyles.primaryLink)}
                          />
                        ) : null}
                        <span {...stylex.props()}>
                          {getColumnValue(item, column)}
                        </span>
                      </td>
                    );
                  })}
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
      <AdminPager rel={rel} searchParams={searchParams} />
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
  return (
    <Link
      href={{
        pathname,
        search: buildQueryString(searchParams, { sort: nextSort }),
      }}
      {...stylex.props(styles.sortLink)}
    >
      {label}
      {sort === name ? <ArrowDown aria-hidden="true" size={12} /> : null}
      {sort === inverted ? <ArrowUp aria-hidden="true" size={12} /> : null}
    </Link>
  );
}

function resolveAlignment(
  alignment: AdminTableColumn<object>["align"],
  index: number,
) {
  return alignment && alignment !== "default"
    ? alignment
    : index === 0
      ? "left"
      : "center";
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
  searchForm: { position: "relative", display: "flex", alignItems: "center" },
  searchIcon: {
    position: "absolute",
    left: space.x3,
    color: colors.inkMuted,
    pointerEvents: "none",
  },
  searchInput: {
    boxSizing: "border-box",
    width: "100%",
    height: "40px",
    paddingRight: space.x4,
    paddingLeft: "38px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.fieldRule,
    borderRadius: controlMetrics.radius,
    outline: "none",
    backgroundColor: colors.fieldBackground,
    color: colors.ink,
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
    "::placeholder": { color: colors.inkMuted, opacity: 1 },
    "::-webkit-search-cancel-button": { appearance: "none" },
  },
  frame: {
    minWidth: 0,
    overflowX: "auto",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
  },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "auto" },
  headerRow: {
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  header: {
    padding: `${space.x2} ${space.x3}`,
    color: colors.inkMuted,
    whiteSpace: "nowrap",
  },
  row: {
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  cell: {
    padding: `${space.x3} ${space.x3}`,
    color: colors.ink,
    verticalAlign: "middle",
  },
  fill: { width: "100%", maxWidth: 0 },

  secondary: { "@media (max-width: 639px)": { display: "none" } },
  groupRow: {
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    backgroundColor: "transparent",
  },
  groupCell: {
    padding: `${space.x2} ${space.x3}`,
    color: colors.ink,
    textAlign: "left",
  },
  groupLink: {
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: { default: colors.ink, ":hover": colors.accentDeep },
    textDecoration: "none",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
  },
  sortLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: space.x1,
    borderRadius: controlMetrics.radiusSmall,
    outline: "none",
    color: { default: colors.inkMuted, ":hover": colors.accentDeep },
    textDecoration: "none",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
  },
  left: { textAlign: "left" },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
});
const alignStyles = {
  center: styles.center,
  left: styles.left,
  right: styles.right,
} as const;
