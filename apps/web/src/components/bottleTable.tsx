import { Link } from "react-router-dom";

import { formatCategoryName } from "../lib/strings";
import { Bottle, Entity } from "../types";
import BottleName from "./bottleName";
import Button from "./button";

type Grouper = undefined | null | Entity;

export default ({
  bottleList,
  groupBy,
  groupTo,
  rel,
}: {
  bottleList: Bottle[];
  groupBy?: (bottle: Bottle) => Grouper;
  groupTo?: (group: Entity) => string;
  rel?: {
    next: string | null;
    nextPage: number | null;
    prev: string | null;
    prevPage: number | null;
  };
}) => {
  let lastGroup: Grouper;
  return (
    <>
      <table className="min-w-full">
        <colgroup>
          <col className="min-w-full sm:w-1/2" />
          <col className="sm:w-1/6" />
          <col className="sm:w-1/6" />
        </colgroup>
        <thead className="border-b border-slate-800 text-sm font-semibold text-slate-500 ">
          <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left sm:pl-3">
              Bottle
            </th>
            <th
              scope="col"
              className="hidden px-3 py-3.5 text-right sm:table-cell"
            >
              Category
            </th>
            <th scope="col" className="py-3.5 pl-3 pr-4 text-right sm:pr-3">
              Age
            </th>
          </tr>
        </thead>
        <tbody>
          {bottleList.map((bottle) => {
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
                    <BottleName bottle={bottle} />
                  </Link>
                </td>
                <td className="hidden px-3 py-4 text-right text-sm sm:table-cell">
                  {formatCategoryName(bottle.category)}
                </td>
                <td className="hidden py-4 pl-3 pr-4 text-right text-sm sm:table-cell sm:pr-3">
                  {bottle.statedAge && `${bottle.statedAge} years`}
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
