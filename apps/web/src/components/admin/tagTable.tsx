import { Link } from "@tanstack/react-router";

import { toTitleCase } from "@peated/server/lib/strings";
import type { PagingRel, Tag } from "@peated/server/types";
import PaginationButtons from "../paginationButtons";

export default function TagTable({
  tagList,
  rel,
}: {
  tagList: Tag[];
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
              Tag
            </th>
            <th
              scope="col"
              className="hidden px-3 py-2.5 text-right sm:table-cell"
            >
              Category
            </th>
          </tr>
        </thead>
        <tbody>
          {tagList.map((tag) => {
            return (
              <tr key={tag.name} className="border-slate-800 border-b text-sm">
                <td className="max-w-0 px-3 py-3">
                  <Link
                    to="/admin/tags/$tagId"
                    params={{ tagId: tag.name }}
                    className="font-medium hover:underline"
                  >
                    {toTitleCase(tag.name)}
                  </Link>
                </td>
                <td className="hidden px-3 py-3 text-right sm:table-cell">
                  {toTitleCase(tag.tagCategory)}
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
