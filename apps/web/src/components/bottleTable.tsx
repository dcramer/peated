"use client";

import { CheckBadgeIcon, StarIcon } from "@heroicons/react/20/solid";
import { formatCategoryName } from "@peated/server/lib/format";
import type { Bottle, CollectionBottle, PagingRel } from "@peated/server/types";
import Link from "@peated/web/components/link";
import type { ComponentProps } from "react";
import BottleLink from "./bottleLink";
import SimpleRatingIndicator from "./simpleRatingIndicator";
import Table from "./table";

export default function BottleTable({
  bottleList,
  rel,
  ...props
}: Omit<ComponentProps<typeof Table>, "items" | "rel" | "columns"> & {
  bottleList: (Bottle | CollectionBottle)[];
  rel?: PagingRel;
}) {
  return (
    <Table<Bottle>
      items={bottleList.map((b) => {
        return "bottle" in b ? b.bottle : b;
      })}
      rel={rel}
      columns={[
        {
          name: "name",
          title: "Bottle",
          sort: "name",
          sortDefaultOrder: "asc",
          className: "min-w-full sm:w-1/2",
          value: (item) => {
            return (
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-x-1">
                  <BottleLink
                    bottle={item}
                    className="font-medium hover:underline"
                  >
                    {item.brand.shortName || item.brand.name} {item.name}
                  </BottleLink>
                  {item.isFavorite && (
                    <StarIcon className="h-4 w-4" aria-hidden="true" />
                  )}
                  {item.hasTasted && (
                    <CheckBadgeIcon className="h-4 w-4" aria-hidden="true" />
                  )}
                </div>
                <div className="text-muted flex gap-x-1 text-sm">
                  {item.category && (
                    <Link
                      href={`/bottles/?category=${item.category}`}
                      className="hover:underline"
                    >
                      {formatCategoryName(item.category)}
                    </Link>
                  )}
                  {!!item.edition && <span>({item.edition})</span>}
                </div>
              </div>
            );
          },
        },
        {
          name: "tastings",
          value: (item) => item.totalTastings.toLocaleString(),
          className: "sm:w-1/6",
          sortDefaultOrder: "desc",
        },
        {
          name: "rating",
          value: (item) => <SimpleRatingIndicator avgRating={item.avgRating} />,
          className: "sm:w-1/6",
          sortDefaultOrder: "desc",
          align: "center",
        },
        {
          name: "age",
          value: (item) =>
            item.statedAge ? (
              <Link
                className="hover:underline"
                href={`/bottles/?age=${item.statedAge}`}
              >{`${item.statedAge} years`}</Link>
            ) : null,
          className: "sm:w-1/6",
          sortDefaultOrder: "desc",
        },
      ]}
      {...props}
    />
  );
}
