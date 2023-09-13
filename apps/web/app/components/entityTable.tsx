import { Link, useLocation } from "@remix-run/react";

import type { Entity, PagingRel } from "@peated/shared/types";
import { buildQueryString } from "~/lib/urls";
import Button from "./button";
import Chip from "./chip";

export default ({
  entityList,
  rel,
}: {
  entityList: Entity[];
  rel?: PagingRel;
}) => {
  const location = useLocation();
  const sort = new URLSearchParams(location.search).get("sort");

  return (
    <>
      <table className="min-w-full">
        <colgroup>
          <col className="min-w-full sm:w-3/5" />
          <col className="sm:w-1/10" />
          <col className="sm:w-3/10" />
        </colgroup>
        <thead className="hidden border-b border-slate-800 text-sm font-semibold text-slate-500 sm:table-header-group">
          <tr>
            <th scope="col" className="px-3 py-2.5 text-left">
              <Link
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
                    sort: sort === "name" ? "-name" : "name",
                  }),
                }}
                className="hover:underline"
              >
                Entity
              </Link>
            </th>
            <th scope="col" className="px-3 py-2.5 text-center sm:table-cell">
              <Link
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
                    sort: sort === "bottles" ? "-bottles" : "bottles",
                  }),
                }}
                className="hover:underline"
              >
                Bottles
              </Link>
            </th>
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
                <td className="hidden space-y-2 px-3 py-3 text-right sm:table-cell">
                  {!!entity.country && (
                    <div>
                      <Link
                        to={`/entities?country=${encodeURIComponent(
                          entity.country,
                        )}`}
                        className="hover:underline"
                      >
                        {entity.country}
                      </Link>
                    </div>
                  )}
                  {!!entity.region && (
                    <div>
                      <Link
                        to={`/entities?region=${encodeURIComponent(
                          entity.region,
                        )}`}
                        className="text-slate-500 hover:underline"
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
