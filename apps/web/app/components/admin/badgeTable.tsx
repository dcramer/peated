import { Link } from "@remix-run/react";

import type { PagingRel } from "@peated/shared/types";
import type { Badge } from "~/types";
import Button from "../button";

export default ({
  badgeList,
  rel,
}: {
  badgeList: Badge[];
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
              Badge
            </th>
          </tr>
        </thead>
        <tbody>
          {badgeList.map((badge) => {
            return (
              <tr key={badge.id} className="border-b border-slate-800 text-sm">
                <td className="max-w-0 px-3 py-3">
                  <Link
                    to={`/admin/badges/${badge.id}`}
                    className="font-medium hover:underline"
                  >
                    {badge.name}
                  </Link>
                  <div className="mt-2 space-x-2">{badge.type}</div>
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
          <div className="flex flex-1 justify-between gap-x-2 sm:justify-end">
            <Button
              to={rel.prevPage ? `?page=${rel.prevPage}` : undefined}
              disabled={!rel.prevPage}
            >
              Previous
            </Button>
            <Button
              to={rel.nextPage ? `?page=${rel.nextPage}` : undefined}
              disabled={!rel.nextPage}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </>
  );
};
