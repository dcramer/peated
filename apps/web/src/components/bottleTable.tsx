"use client";

import { CheckBadgeIcon, StarIcon } from "@heroicons/react/20/solid";
import { formatCategoryName } from "@peated/server/lib/format";
import type {
  Bottle,
  CollectionBottle,
  Entity,
  PagingRel,
} from "@peated/server/types";
import Link from "@peated/web/components/link";
import { useSearchParams } from "next/navigation";
import BottleLink from "./bottleLink";
import PaginationButtons from "./paginationButtons";
import SortParam from "./sortParam";

type Grouper = undefined | null | Entity;

export default function BottleTable({
  bottleList,
  groupBy,
  groupTo,
  rel,
  sort: initialSort,
  noHeaders = false,
}: {
  bottleList: (Bottle | CollectionBottle)[];
  groupBy?: (bottle: Bottle) => Grouper;
  groupTo?: (group: Entity) => string;
  rel?: PagingRel;
  sort?: string;
  noHeaders?: boolean;
}) {
  const searchParams = useSearchParams();
  const sort = initialSort ?? searchParams.get("sort");

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
        {!noHeaders && (
          <thead className="text-light hidden border-b border-slate-800 text-sm font-semibold sm:table-header-group">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left sm:pl-3">
                <SortParam name="name" label="Bottle" sort={sort} />
              </th>
              <th
                scope="col"
                className="hidden px-3 py-3.5 text-center sm:table-cell"
              >
                <SortParam name="tastings" sort={sort} defaultOrder="desc" />
              </th>
              <th
                scope="col"
                className="hidden px-3 py-3.5 text-center sm:table-cell"
              >
                <SortParam name="rating" sort={sort} defaultOrder="desc" />
              </th>
              <th
                scope="col"
                className="hidden py-3.5 pl-3 pr-4 text-right sm:table-cell sm:pr-3"
              >
                <SortParam name="age" sort={sort} defaultOrder="desc" />
              </th>
            </tr>
          </thead>
        )}
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
                      <Link href={groupTo(group)}>{group.name}</Link>
                    ) : (
                      group.name
                    )}
                  </th>
                </tr>
              ) : null,
              <tr key={bottle.id} className="border-b border-slate-800">
                <td className="max-w-0 py-4 pl-4 pr-3 text-sm sm:pl-3">
                  <div className="flex items-center space-x-1">
                    <BottleLink
                      bottle={bottle}
                      className="font-medium hover:underline"
                    >
                      {bottle.fullName}
                    </BottleLink>
                    {bottle.vintageYear && (
                      <>
                        <span className="text-light">
                          ({bottle.vintageYear})
                        </span>
                      </>
                    )}
                    {bottle.isFavorite && (
                      <StarIcon className="h-4 w-4" aria-hidden="true" />
                    )}
                    {bottle.hasTasted && (
                      <CheckBadgeIcon className="h-4 w-4" aria-hidden="true" />
                    )}
                  </div>
                  <div className="text-light text-sm">
                    <Link
                      href={`/bottles/?category=${bottle.category}`}
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
                      href={`/bottles/?age=${bottle.statedAge}`}
                    >{`${bottle.statedAge} years`}</Link>
                  )}
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
      <PaginationButtons rel={rel} />
    </>
  );
}
