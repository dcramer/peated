"use client";

import type { Entity, EntityType, PagingRel } from "@peated/server/types";
import Link from "@peated/web/components/link";
import classNames from "@peated/web/lib/classNames";
import { useSearchParams } from "next/navigation";
import { getEntityTypeSearchUrl } from "../lib/urls";
import Chip from "./chip";
import PaginationButtons from "./paginationButtons";
import SortParam from "./sortParam";

export default function EntityTable({
  entityList,
  rel,
  withLocations = false,
  withTastings = false,
  sort: initialSort,
  type,
}: {
  entityList: Entity[];
  withTastings?: boolean;
  withLocations?: boolean;
  rel?: PagingRel;
  sort?: string;
  type: EntityType;
}) {
  const searchParams = useSearchParams();
  const sort = initialSort ?? searchParams.get("sort");

  const link = getEntityTypeSearchUrl(type);

  return (
    <>
      <table className="min-w-full">
        <colgroup>
          <col
            className={classNames(
              "min-w-full",
              withTastings && withLocations ? "sm:w-1/2" : "",
              withTastings && !withLocations ? "sm:w-4/5" : "",
              !withTastings && withLocations ? "sm:w-3/5" : "",
              !withTastings && !withLocations ? "sm:w-4/5" : "",
            )}
          />
          <col className="sm:w-1/10" />
          {withTastings && <col className="sm:w-1/10" />}
          {withLocations && <col className="sm:w-3/10" />}
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
            {withLocations && (
              <th
                scope="col"
                className="hidden px-3 py-2.5 text-right sm:table-cell"
              >
                Location
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {entityList.map((entity) => {
            return (
              <tr key={entity.id} className="border-b border-slate-800 text-sm">
                <td className="max-w-0 px-3 py-3">
                  <Link
                    href={`/entities/${entity.id}`}
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
                        href={`${link}?type=${encodeURIComponent(t)}`}
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
                {withLocations && (
                  <td className="hidden space-y-2 px-3 py-3 text-right sm:table-cell">
                    {!!entity.country && (
                      <div>
                        <Link
                          href={`/locations/${entity.country.slug}`}
                          className="hover:underline"
                        >
                          {entity.country.name}
                        </Link>
                      </div>
                    )}
                    {!!entity.region && (
                      <div>
                        <Link
                          href={`/${link}?region=${encodeURIComponent(
                            entity.region.id,
                          )}`}
                          className="text-light hover:underline"
                        >
                          {entity.region.name}
                        </Link>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <PaginationButtons rel={rel} />
    </>
  );
}
