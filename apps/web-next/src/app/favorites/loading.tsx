import SimpleHeader from "@peated/web/components/simpleHeader";

function BottleTableRowSkeleton() {
  return (
    <tr>
      <td className="p-2" colSpan={4}>
        <div className="animate-pulse bg-slate-800 p-1 -indent-96">Loading</div>
      </td>
    </tr>
  );
}
export default function Loading() {
  return (
    <>
      <SimpleHeader>Favorites</SimpleHeader>
      <table className="min-w-full">
        <colgroup>
          <col className="min-w-full sm:w-1/2" />
          <col className="sm:w-1/6" />
          <col className="sm:w-1/6" />
          <col className="sm:w-1/6" />
        </colgroup>
        <thead className="text-light hidden border-b border-slate-800 text-sm font-semibold sm:table-header-group"></thead>
        <tbody>
          <BottleTableRowSkeleton />
          <BottleTableRowSkeleton />
          <BottleTableRowSkeleton />
        </tbody>
      </table>
    </>
  );
}
