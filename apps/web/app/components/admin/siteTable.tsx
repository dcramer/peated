import { Link } from "@remix-run/react";

import type { ExternalSite, PagingRel } from "@peated/server/types";
import PaginationButtons from "../paginationButtons";
import TimeSince from "../timeSince";

export default ({
  siteList,
  rel,
}: {
  siteList: ExternalSite[];
  rel?: PagingRel;
}) => {
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
              Site
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
          {siteList.map((site) => {
            return (
              <tr key={site.id} className="border-b border-slate-800 text-sm">
                <td className="max-w-0 px-3 py-3">
                  <Link
                    to={`/admin/sites/${site.type}`}
                    className="font-medium hover:underline"
                  >
                    {site.name}
                  </Link>
                  <div className="mt-2 space-x-2">{site.type}</div>
                </td>
                <td className="hidden px-3 py-3 text-right sm:table-cell">
                  {site.lastRunAt ? (
                    <TimeSince date={site.lastRunAt} />
                  ) : (
                    <>&mdash;</>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <PaginationButtons rel={rel} />
    </>
  );
};
