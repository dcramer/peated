import { Link } from "@remix-run/react";

import type { PagingRel, Store } from "@peated/server/types";
import Button from "../button";
import TimeSince from "../timeSince";

export default ({
  storeList,
  rel,
}: {
  storeList: Store[];
  rel?: PagingRel;
}) => {
  return (
    <>
      <table className="min-w-full">
        <colgroup>
          <col className="min-w-full sm:w-1/2" />
          <col className="sm:w-1/2" />
        </colgroup>
        <thead className="hidden border-b border-slate-800 text-sm font-semibold text-slate-500 sm:table-header-group">
          <tr>
            <th scope="col" className="px-3 py-2.5 text-left">
              Store
            </th>
            <th
              scope="col"
              className="hidden px-3 py-2.5 text-right sm:table-cell"
            >
              Last Run
            </th>
          </tr>
        </thead>
        <tbody>
          {storeList.map((store) => {
            return (
              <tr key={store.id} className="border-b border-slate-800 text-sm">
                <td className="max-w-0 px-3 py-3">
                  <Link
                    to={`/admin/stores/${store.id}`}
                    className="font-medium hover:underline"
                  >
                    {store.name}
                  </Link>
                  <div className="mt-2 space-x-2">{store.type}</div>
                </td>
                <td className="hidden px-3 py-3 text-right sm:table-cell">
                  {store.lastRunAt ? (
                    <TimeSince date={store.lastRunAt} />
                  ) : (
                    <>&mdash;</>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rel && (
        <nav
          className="flex items-center justify-between py-3"
          aria-label="Pagination"
        >
          <div className="flex flex-auto justify-between gap-x-2 sm:justify-end">
            <Button
              to={rel.prevCursor ? `?cursor=${rel.prevCursor}` : undefined}
              disabled={!rel.prevCursor}
            >
              Previous
            </Button>
            <Button
              to={rel.nextCursor ? `?cursor=${rel.nextCursor}` : undefined}
              disabled={!rel.nextCursor}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </>
  );
};
