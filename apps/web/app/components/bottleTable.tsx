import { Link, useLocation } from "@remix-run/react";

import type { PagingRel } from "@peated/shared/types";
import { buildQueryString } from "~/lib/urls";
import type { Bottle, CollectionBottle, Entity } from "~/types";
import { formatCategoryName } from "../lib/strings";
import Button from "./button";

type Grouper = undefined | null | Entity;

export default ({
  bottleList,
  groupBy,
  groupTo,
  rel,
}: {
  bottleList: (Bottle | CollectionBottle)[];
  groupBy?: (bottle: Bottle) => Grouper;
  groupTo?: (group: Entity) => string;
  rel?: PagingRel;
}) => {
  const location = useLocation();
  const sort = new URLSearchParams(location.search).get("sort");

  let lastGroup: Grouper;
  return (
    <>
      <table className="min-w-full">
        <colgroup>
          <col className="min-w-full sm:w-1/2" />
          <col className="sm:w-1/6" />
          <col className="sm:w-1/6" />
          <col className="sm:w-1/6" />
        </colgroup>
        <thead className="hidden border-b border-slate-800 text-sm font-semibold text-slate-500 sm:table-header-group">
          <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left sm:pl-3">
              <Link
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
                    sort: sort === "name" ? "-name" : "name",
                  }),
                }}
                className="hover:underline"
              >
                Bottle
              </Link>
            </th>
            <th
              scope="col"
              className="hidden px-3 py-3.5 text-center sm:table-cell"
            >
              <Link
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
                    sort: sort === "tastings" ? "-tastings" : "tastings",
                  }),
                }}
                className="hover:underline"
              >
                Tastings
              </Link>
            </th>
            <th
              scope="col"
              className="hidden px-3 py-3.5 text-center sm:table-cell"
            >
              <Link
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
                    sort: sort === "rating" ? "-rating" : "rating",
                  }),
                }}
                className="hover:underline"
              >
                Rating
              </Link>
            </th>
            <th
              scope="col"
              className="hidden py-3.5 pl-3 pr-4 text-right sm:table-cell sm:pr-3"
            >
              <Link
                to={{
                  pathname: location.pathname,
                  search: buildQueryString(location.search, {
                    sort: sort === "age" ? "-age" : "age",
                  }),
                }}
                className="hover:underline"
              >
                Age
              </Link>
            </th>
          </tr>
        </thead>
        <tbody>
          {bottleList.map((bottleOrCb) => {
            const bottle =
              "bottle" in bottleOrCb ? bottleOrCb.bottle : bottleOrCb;
            const group = groupBy && groupBy(bottle);
            const showGroup = group && group.id !== lastGroup?.id;
            if (group) lastGroup = group;
            return [
              showGroup ? (
                <tr key={`g-${group.id}`} className="border-b border-slate-800">
                  <th
                    colSpan={5}
                    scope="colgroup"
                    className="bg-slate-800 py-2 pl-4 pr-3 text-left text-sm font-semibold sm:pl-3"
                  >
                    {groupTo ? (
                      <Link to={groupTo(group)}>{group.name}</Link>
                    ) : (
                      group.name
                    )}
                  </th>
                </tr>
              ) : null,
              <tr key={bottle.id} className="border-b border-slate-800">
                <td className="max-w-0 py-4 pl-4 pr-3 text-sm sm:pl-3">
                  <Link
                    to={`/bottles/${bottle.id}`}
                    className="font-medium hover:underline"
                  >
                    {bottle.fullName}
                  </Link>
                  <div className="text-sm text-slate-500">
                    <Link
                      to={`/bottles/?category=${bottle.category}`}
                      className="hover:underline"
                    >
                      {formatCategoryName(bottle.category)}
                    </Link>
                  </div>
                </td>
                <td className="hidden px-3 py-4 text-center text-sm sm:table-cell">
                  {bottle.totalTastings.toLocaleString()}
                </td>
                <td className="hidden px-3 py-4 text-center text-sm sm:table-cell">
                  {bottle.avgRating ? bottle.avgRating.toFixed(2) : null}
                </td>
                <td className="hidden py-4 pl-3 pr-4 text-right text-sm sm:table-cell sm:pr-3">
                  {bottle.statedAge && (
                    <Link
                      className="hover:underline"
                      to={`/bottles/?age=${bottle.statedAge}`}
                    >{`${bottle.statedAge} years`}</Link>
                  )}
                </td>
              </tr>,
            ];
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
