import { Link, useLocation } from "@remix-run/react";

import { toTitleCase } from "@peated/server/src/lib/strings";
import type { PagingRel } from "@peated/server/types";
import classNames from "@peated/web/lib/classNames";
import type { ReactElement } from "react";
import PaginationButtons from "./paginationButtons";
import SortParam from "./sortParam";

type Column<T extends Record<string, any>> = {
  name: string;
  sort?: string;
  sortDefaultOrder?: "asc" | "desc";
  title?: string;
  value?: (item: T) => ReactElement | string | null | false;
};

export default function Table<T extends Record<string, any>>({
  items,
  columns,
  primaryKey = (item: T) => String(item.id),
  url = (item: T) => primaryKey(item),
  rel,
  defaultSort,
}: {
  items: T[];
  columns: Column<T>[];
  primaryKey?: (item: T) => string;
  url?: (item: T) => string;
  rel?: PagingRel;
  defaultSort?: string;
}) {
  const location = useLocation();
  const currentSort =
    new URLSearchParams(location.search).get("sort") ?? defaultSort;

  return (
    <>
      <table className="min-w-full table-auto">
        <thead className="text-light hidden border-b border-slate-800 text-sm font-semibold sm:table-header-group">
          <tr>
            {columns.map((col, colN) => {
              const colName = col.title ?? toTitleCase(String(col.name));
              return (
                <th
                  scope="col"
                  key={col.name}
                  className={classNames(
                    "px-3 py-2.5",
                    colN === 0
                      ? "text-left"
                      : "hidden text-right sm:table-cell",
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
        <tbody>
          {items.map((item, itemN) => {
            const pk = primaryKey(item);
            const urlPath = url(item);
            return (
              <tr key={pk} className="border-b border-slate-800 text-sm">
                {columns.map((col, colN) => {
                  const value = col.value ? col.value(item) : item[col.name];
                  return (
                    <td
                      key={String(col)}
                      className={classNames(
                        "p-3",
                        colN === 0
                          ? "text-left"
                          : "hidden text-right sm:table-cell",
                      )}
                    >
                      {colN === 0 && urlPath ? (
                        <Link to={urlPath}>{value}</Link>
                      ) : (
                        value
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <PaginationButtons rel={rel} />
    </>
  );
}
