import { Link } from "@tanstack/react-router";

import type { Badge, PagingRel } from "@peated/server/types";
import BadgeImage from "../badgeImage";
import PaginationButtons from "../paginationButtons";

export default function BadgeTable({
  badgeList,
  rel,
}: {
  badgeList: Badge[];
  rel?: PagingRel;
}) {
  return (
    <>
      <table className="min-w-full">
        <colgroup>
          <col className="min-w-full sm:w-1/2" />
          <col className="sm:w-1/2" />
        </colgroup>
        <thead className="hidden border-slate-800 border-b font-semibold text-muted text-sm sm:table-header-group">
          <tr>
            <th scope="col" className="px-3 py-2.5 text-left">
              Badge
            </th>
          </tr>
        </thead>
        <tbody>
          {badgeList.map((badge) => {
            return (
              <tr key={badge.id} className="border-slate-800 border-b text-sm">
                <td className="max-w-0 px-3 py-3">
                  <div className="flex items-center gap-x-4">
                    <BadgeImage badge={badge} size={48} />
                    <div>
                      <Link
                        to={`/admin/badges/${badge.id}`}
                        className="font-medium hover:underline"
                      >
                        {badge.name}
                      </Link>
                      <div className="mt-2 space-x-2 text-muted">
                        {badge.checks!.length} check(s)
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <PaginationButtons rel={rel} />
    </>
  );
}
