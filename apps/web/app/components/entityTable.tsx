import { Link, useLocation } from "@remix-run/react";

import type { Entity, PagingRel } from "@peated/server/types";
import classNames from "@peated/web/lib/classNames";
import Chip from "./chip";
import PaginationButtons from "./paginationButtons";
import SortParam from "./sortParam";

export default ({
  entityList,
  rel,
  withTastings = false,
  sort: initialSort,
}: {
  entityList: Entity[];
  withTastings?: boolean;
  rel?: PagingRel;
  sort?: string;
}) => {
  const location = useLocation();
  const sort = initialSort ?? new URLSearchParams(location.search).get("sort");

  return (
    <>
      <table className="min-w-full">
        <colgroup>
          <col
            className={classNames(
              "min-w-full",
              withTastings ? "sm:w-1/2" : "sm:w-3/5",
            )}
          />
          <col className="sm:w-1/10" />
          {withTastings && <col className="sm:w-1/10" />}
          <col className="sm:w-3/10" />
        </colgroup>
        <thead className="text-light hidden border-b border-slate-800 text-sm font-semibold sm:table-header-group">
          <tr>
            <th scope="col" className="px-3 py-2.5 text-left">
              <SortParam name="name" label="Entity" sort={sort} />
            </th>
            <th scope="col" className="px-3 py-2.5 text-center sm:table-cell">
              <SortParam name="bottles" sort={sort} defaultOrder="desc" />
            </th>
            {withTastings && (
              <th scope="col" className="px-3 py-2.5 text-center sm:table-cell">
                <SortParam name="tastings" sort={sort} defaultOrder="desc" />
              </th>
            )}
            <th
              scope="col"
              className="hidden px-3 py-2.5 text-right sm:table-cell"
            >
              Location
            </th>
          </tr>
        </thead>
        <tbody>
          {entityList.map((entity) => {
            return (
              <tr key={entity.id} className="border-b border-slate-800 text-sm">
                <td className="max-w-0 px-3 py-3">
                  <Link
                    to={`/entities/${entity.id}`}
                    className="font-medium hover:underline"
                  >
                    {entity.name}
                  </Link>
                  <div className="mt-2 space-x-2">
                    {entity.type.sort().map((t) => (
                      <Chip
                        key={t}
                        size="small"
                        as={Link}
                        to={`/entities?type=${encodeURIComponent(t)}`}
                      >
                        {t}
                      </Chip>
                    ))}
                  </div>
                </td>
                <td className="hidden px-3 py-3 text-center sm:table-cell">
                  {entity.totalBottles.toLocaleString()}
                </td>
                {withTastings && (
                  <td className="hidden px-3 py-3 text-center sm:table-cell">
                    {entity.totalTastings.toLocaleString()}
                  </td>
                )}
                <td className="hidden space-y-2 px-3 py-3 text-right sm:table-cell">
                  {!!entity.country && (
                    <div>
                      <Link
                        to={`/locations/${entity.country.slug}`}
                        className="hover:underline"
                      >
                        {entity.country.name}
                      </Link>
                    </div>
                  )}
                  {!!entity.region && (
                    <div>
                      <Link
                        to={`/entities?region=${encodeURIComponent(
                          entity.region,
                        )}`}
                        className="text-light hover:underline"
                      >
                        {entity.region}
                      </Link>
                    </div>
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
