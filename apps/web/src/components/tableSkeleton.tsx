import classNames from "../lib/classNames";

export default function TableSkeleton({
  columnClassNames,
  rows = 12,
  withSearch = false,
  firstColumnLines = 1,
}: {
  columnClassNames: string[];
  rows?: number;
  withSearch?: boolean;
  firstColumnLines?: 1 | 2;
}) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      {withSearch && (
        <div className="my-2 flex items-center gap-x-2 px-3 py-2">
          <div className="h-5 w-5 animate-pulse rounded bg-slate-800" />
          <div className="h-9 flex-grow animate-pulse rounded bg-slate-800" />
        </div>
      )}
      <table className="min-w-full table-auto" aria-hidden="true">
        <colgroup className="table-column-group">
          {columnClassNames.map((className, index) => (
            <col key={index} className={className} />
          ))}
        </colgroup>
        <thead className="text-muted hidden border-b border-slate-800 text-sm font-semibold sm:table-header-group">
          <tr>
            {columnClassNames.map((_, index) => (
              <th
                key={index}
                scope="col"
                className={classNames(
                  "px-3 py-2.5",
                  index !== 0 ? "hidden sm:table-cell" : "",
                )}
              >
                <div
                  className={classNames(
                    "h-4 animate-pulse rounded bg-slate-800",
                    index === 0 ? "w-24" : "mx-auto w-16",
                  )}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="table-row-group">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr
              key={rowIndex}
              className="table-row border-b border-slate-800 text-sm"
            >
              {columnClassNames.map((_, columnIndex) => (
                <td
                  key={columnIndex}
                  className={classNames(
                    "p-3",
                    columnIndex !== 0 ? "hidden sm:table-cell" : "table-cell",
                  )}
                >
                  <div
                    className={classNames(
                      "h-4 animate-pulse rounded bg-slate-800",
                      columnIndex === 0 ? "w-4/5 max-w-lg" : "mx-auto w-12",
                    )}
                  />
                  {columnIndex === 0 && firstColumnLines === 2 && (
                    <div className="mt-2 h-3 w-32 animate-pulse rounded bg-slate-800" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
