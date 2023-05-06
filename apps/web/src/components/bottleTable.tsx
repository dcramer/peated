import { Link } from "react-router-dom";

import { Bottle, Brand, Distiller } from "../types";
import { formatCategoryName } from "../lib/strings";

type Grouper = undefined | null | Brand | Distiller;

export default ({
  bottleList,
  groupBy,
  groupTo,
}: {
  bottleList: Bottle[];
  groupBy?: (bottle: Bottle) => Grouper;
  groupTo?: (group: Brand | Distiller) => string;
}) => {
  let lastGroup: Grouper;
  return (
    <table className="min-w-full">
      <colgroup>
        <col className="min-w-full sm:w-1/2" />
        <col className="sm:w-1/6" />
        <col className="sm:w-1/6" />
      </colgroup>
      <thead className="border-b border-gray-300 text-gray-900">
        <tr>
          <th
            scope="col"
            className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-3"
          >
            Bottle
          </th>
          <th
            scope="col"
            className="hidden px-3 py-3.5 text-right text-sm font-semibold text-gray-900 sm:table-cell"
          >
            Category
          </th>
          <th
            scope="col"
            className="py-3.5 pl-3 pr-4 text-right text-sm font-semibold text-gray-900 sm:pr-3"
          >
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
              <tr key={`g-${group.id}`} className="border-b border-gray-200">
                <th
                  colSpan={5}
                  scope="colgroup"
                  className="bg-gray-50 py-2 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-3"
                >
                  {groupTo ? (
                    <Link to={groupTo(group)}>{group.name}</Link>
                  ) : (
                    group.name
                  )}
                </th>
              </tr>
            ) : null,
            <tr key={bottle.id} className="border-b border-gray-200">
              <td className="max-w-0 py-4 pl-4 pr-3 text-sm sm:pl-3">
                <Link
                  to={`/bottles/${bottle.id}`}
                  className="font-bold text-peated hover:underline"
                >
                  {bottle.name}
                </Link>
                <div className="mt-1 truncate text-gray-500">
                  {bottle.series}
                </div>
              </td>
              <td className="hidden px-3 py-4 text-right text-sm text-gray-500 sm:table-cell">
                {formatCategoryName(bottle.category)}
              </td>
              <td className="hidden py-4 pl-3 pr-4 text-right text-sm text-gray-500 sm:pr-3 sm:table-cell">
                {bottle.statedAge && `${bottle.statedAge} years`}
              </td>
            </tr>,
          ];
        })}
      </tbody>
    </table>
  );
};
