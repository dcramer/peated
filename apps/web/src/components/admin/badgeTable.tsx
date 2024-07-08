import Link from "@peated/web/components/link";

import type { Badge, PagingRel } from "@peated/server/types";
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
        <thead className="text-light hidden border-b border-slate-800 text-sm font-semibold sm:table-header-group">
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
                    href={`/admin/badges/${badge.id}`}
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
      <PaginationButtons rel={rel} />
    </>
  );
}
