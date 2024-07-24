"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import type { PagingRel } from "@peated/server/types";
import Link from "@peated/web/components/link";
import classNames from "@peated/web/lib/classNames";
import { useSearchParams } from "next/navigation";
import type { ReactElement } from "react";
import PaginationButtons from "./paginationButtons";
import SearchBar from "./searchBar";
import SortParam from "./sortParam";

export type Column<T extends Record<string, any>> = {
  name: string;
  sort?: string;
  sortDefaultOrder?: "asc" | "desc";
  align?: "left" | "right" | "center" | "default";
  title?: string;
  className?: string;
  value?: (item: T) => ReactElement | string | null | false;
  hidden?: boolean;
};

type Grouper = { id: string | number; name: string } & Record<string, any>;

export default function Table<
  T extends Record<string, any>,
  G extends Grouper = Grouper,
>({
  items,
  columns,
  primaryKey = (item: T) => String(item.id),
  url = (item: T) => null,
  rel,
  defaultSort,
  groupBy,
  groupTo,
  withSearch = false,
  noHeaders = false,
}: {
  items: T[];
  columns: Column<T>[];
  primaryKey?: (item: T) => string;
  url?: (item: T) => string | null;
  rel?: PagingRel;
  defaultSort?: string;
  groupBy?: (item: T) => G;
  groupTo?: (group: G) => string;
  withSearch?: boolean;
  noHeaders?: boolean;
}) {
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") ?? defaultSort;
  let lastGroup: G;

  return (
    <>
      {withSearch && <SearchBar />}
      <table className="min-w-full table-auto">
        <colgroup className="table-column-group">
          {columns.map((col, colN) => {
            return (
              <col
                key={col.name}
                className={classNames(
                  col.className ?? (colN !== 0 ? "w-32" : ""),
                )}
              />
            );
          })}
        </colgroup>
        {!noHeaders && (
          <thead className="text-muted hidden border-b border-slate-800 text-sm font-semibold sm:table-header-group">
            <tr>
              {columns.map((col, colN) => {
                if (col.hidden) return null;

                const colName = col.title ?? toTitleCase(String(col.name));
                const colAlign =
                  (col.align || "default") !== "default"
                    ? col.align
                    : colN === 0
                      ? "left"
                      : "center";

                return (
                  <th
                    scope="col"
                    key={col.name}
                    className={classNames(
                      "px-3 py-2.5",
                      colN !== 0 ? "hidden sm:table-cell" : "",
                      colAlign === "left"
                        ? "text-left"
                        : colAlign === "center"
                          ? "text-center"
                          : "text-right",
                    )}
                  >
                    {col.sort ? (
                      <SortParam
                        name={col.sort}
                        label={colName}
                        sort={currentSort}
                        defaultOrder={col.sortDefaultOrder ?? "desc"}
                      />
                    ) : (
                      colName
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
        )}
        <tbody className="table-row-group">
          {items.map((item, itemN) => {
            const pk = primaryKey(item);
            const urlPath = url(item);

            const group = groupBy && groupBy(item);
            const showGroup = group && group.id !== lastGroup?.id;
            if (group) lastGroup = group;
            return [
              showGroup ? (
                <tr key={`g-${group.id}`} className="border-b border-slate-800">
                  <th
                    colSpan={5}
                    scope="colgroup"
                    className="bg-slate-800 py-2 pl-4 pr-3 text-left text-sm font-semibold sm:pl-3"
                  >
                    {groupTo ? (
                      <Link href={groupTo(group)}>{group.name}</Link>
                    ) : (
                      group.name
                    )}
                  </th>
                </tr>
              ) : null,
              <tr
                key={pk}
                className="table-row border-b border-slate-800 text-sm"
              >
                {columns.map((col, colN) => {
                  if (col.hidden) return null;

                  const value = col.value ? col.value(item) : item[col.name];
                  const colAlign =
                    (col.align || "default") !== "default"
                      ? col.align
                      : colN === 0
                        ? "left"
                        : "center";

                  return (
                    <td
                      key={col.name}
                      className={classNames(
                        "group relative flex items-center gap-x-2 p-3",
                        colN !== 0 ? "hidden sm:table-cell" : "",
                        colAlign === "left"
                          ? "text-left"
                          : colAlign === "center"
                            ? "text-center"
                            : "text-right",
                      )}
                    >
                      {colN === 0 && urlPath && (
                        <Link href={urlPath} className="absolute inset-0" />
                      )}
                      {value}
                    </td>
                  );
                })}
              </tr>,
            ];
          })}
        </tbody>
      </table>
      <PaginationButtons rel={rel} />
    </>
  );
}
