"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import type { PagingRel } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";
import { ArrowDown, ArrowUp } from "lucide-react";
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
import { AppLink } from "../appLink";
import { LoadingPlaceholder } from "../feedback.stylex";
import { TextInput } from "../field.stylex";
import { linkedRowStyles } from "../linkedRow.stylex";
import { LinkPending } from "../linkPending.stylex";
import { AdminPager } from "./adminUtility.stylex";

export type AdminTableColumn<Item extends object> = {
  align?: "center" | "default" | "left" | "right";
  fill?: boolean;
  hidden?: boolean;
  name: string;
  showOnMobile?: boolean;
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

type AdminTableLoadingProps = {
  columns?: 1 | 2 | 3 | 4;
  label?: string;
  rows?: 3 | 4 | 5 | 6;
  withSearch?: boolean;
};

const loadingDelays = [0, 1, 2, 3, 4] as const;

/** Reserves the shared administrator table structure while its rows load. */
export function AdminTableLoading({
  columns = 2,
  label = "Loading records",
  rows = 5,
  withSearch = false,
}: AdminTableLoadingProps) {
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
      <div {...stylex.props(styles.frame)}>
        <table {...stylex.props(styles.table)}>
          <thead>
            <tr {...stylex.props(styles.headerRow)}>
              {Array.from({ length: columns }, (_, columnIndex) => (
                <th
                  key={columnIndex}
                  scope="col"
                  {...stylex.props(
                    styles.header,
                    columnIndex > 0 && styles.secondary,
                  )}
                >
                  <LoadingPlaceholder
                    delay={loadingDelays[columnIndex]}
                    preset="metadata"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, rowIndex) => (
              <tr key={rowIndex} {...stylex.props(styles.row)}>
                {Array.from({ length: columns }, (_, columnIndex) => (
                  <td
                    key={columnIndex}
                    {...stylex.props(
                      styles.cell,
                      columnIndex > 0 && styles.secondary,
                    )}
                  >
                    <LoadingPlaceholder
                      delay={
                        loadingDelays[
                          (rowIndex + columnIndex) % loadingDelays.length
                        ]
                      }
                      preset={columnIndex === 0 ? "text" : "metadata"}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
  const scrollsOnMobile = columns.some(
    (column, index) => index > 0 && column.showOnMobile,
  );

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
      <div
        aria-label={scrollsOnMobile ? "Scrollable table" : undefined}
        role={scrollsOnMobile ? "region" : undefined}
        tabIndex={scrollsOnMobile ? 0 : undefined}
        {...stylex.props(
          styles.frame,
          scrollsOnMobile && styles.scrollableFrame,
        )}
      >
        <table
          {...stylex.props(
            styles.table,
            scrollsOnMobile && styles.mobileWideTable,
          )}
        >
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
                        index > 0 && !column.showOnMobile && styles.secondary,
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
                        <AppLink
                          href={groupTo(group)}
                          {...stylex.props(styles.groupLink)}
                        >
                          {groupItem(group)}
                        </AppLink>
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
                          index > 0 && !column.showOnMobile && styles.secondary,
                        )}
                      >
                        {index === 0 && itemHref ? (
                          <AppLink
                            aria-label={`Open ${itemKey}`}
                            href={itemHref}
                            {...stylex.props(linkedRowStyles.primaryLink)}
                          >
                            <LinkPending />
                          </AppLink>
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
  searchForm: { display: "flex", alignItems: "center" },
  loadingSearch: {
    width: "100%",
    height: controlMetrics.controlHeight,
    borderRadius: controlMetrics.radius,
    backgroundColor: colors.inset,
  },
  frame: {
    minWidth: 0,
    overflowX: "auto",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.hairline,
  },
  scrollableFrame: {
    outline: "none",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
  },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "auto" },
  mobileWideTable: {
    "@media (max-width: 639px)": { minWidth: "720px" },
  },
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
  left: { textAlign: "left" },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
});
const alignStyles = {
  center: styles.center,
  left: styles.left,
  right: styles.right,
} as const;
