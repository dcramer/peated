function BottleTableRowSkeleton() {
  return (
    <tr>
      <td className="p-2" colSpan={4}>
        <div className="-indent-96 animate-pulse bg-slate-800 p-1">Loading</div>
      </td>
    </tr>
  );
}

export default function Loading() {
  return (
    <>
      <table className="min-w-full">
        <colgroup>
          <col className="min-w-full sm:w-1/2" />
          <col className="sm:w-1/6" />
          <col className="sm:w-1/6" />
          <col className="sm:w-1/6" />
        </colgroup>
        <thead className="hidden border-slate-800 border-b font-semibold text-muted text-sm sm:table-header-group" />
        <tbody>
          <BottleTableRowSkeleton />
          <BottleTableRowSkeleton />
          <BottleTableRowSkeleton />
        </tbody>
      </table>
    </>
  );
}
