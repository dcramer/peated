export default function TableSkeleton({
  rows = 10,
  columns = 3,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <table className="min-w-full table-auto">
      <thead className="text-muted hidden border-b border-slate-800 text-sm font-semibold sm:table-header-group">
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} className="px-3 py-2.5">
              <div className="h-4 w-20 animate-pulse rounded bg-slate-800" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="table-row-group">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <tr key={rowIdx} className="table-row border-b border-slate-800">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <td key={colIdx} className="p-3">
                <div
                  className="h-4 animate-pulse rounded bg-slate-800"
                  style={{
                    width: colIdx === 0 ? "60%" : "40%",
                    animationDelay: `${rowIdx * 50}ms`,
                  }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
