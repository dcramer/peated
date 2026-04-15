"use client";

import { CheckBadgeIcon, StarIcon } from "@heroicons/react/20/solid";
import { formatCategoryName } from "@peated/server/lib/format";
import type {
  Bottle,
  BottleRelease,
  CollectionBottle,
  PagingRel,
} from "@peated/server/types";
import Link from "@peated/web/components/link";
import type { ComponentProps } from "react";
import { formatBottlingName } from "../lib/bottlings";
import BottleLink from "./bottleLink";
import SimpleRatingIndicator from "./simpleRatingIndicator";
import SingleCaskChip from "./singleCaskChip";
import Table from "./table";

type BottleRow = {
  bottle: Bottle;
  release: BottleRelease | null;
  key: string;
};

export default function BottleTable({
  bottleList,
  rel,
  ...props
}: Omit<ComponentProps<typeof Table>, "items" | "rel" | "columns"> & {
  bottleList: (Bottle | CollectionBottle)[];
  rel?: PagingRel;
}) {
  const rows: BottleRow[] = bottleList.map((item) =>
    "bottle" in item
      ? {
          bottle: item.bottle,
          release: item.release ?? null,
          key: `collection-${item.id}`,
        }
      : { bottle: item, release: null, key: `bottle-${item.id}` },
  );

  return (
    <Table<BottleRow>
      items={rows}
      primaryKey={(item) => item.key}
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
                    bottle={item.bottle}
                    className="font-medium hover:underline"
                  >
                    {item.bottle.brand.shortName || item.bottle.brand.name}{" "}
                    {item.bottle.name}
                  </BottleLink>
                  {item.bottle.isFavorite && (
                    <StarIcon className="h-4 w-4" aria-hidden="true" />
                  )}
                  {item.bottle.hasTasted && (
                    <CheckBadgeIcon className="h-4 w-4" aria-hidden="true" />
                  )}
                  {!item.release && item.bottle.singleCask && (
                    <SingleCaskChip />
                  )}
                </div>
                <div className="text-muted flex flex-col gap-y-1 text-sm">
                  {item.release && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span>
                        Specific Bottling: {formatBottlingName(item.release)}
                      </span>
                      {item.release.singleCask && <SingleCaskChip />}
                    </div>
                  )}
                  {item.bottle.category && (
                    <Link
                      href={`/bottles/?category=${item.bottle.category}`}
                      className="hover:underline"
                    >
                      {formatCategoryName(item.bottle.category)}
                    </Link>
                  )}
                </div>
              </div>
            );
          },
        },
        {
          name: "tastings",
          value: (item) => item.bottle.totalTastings.toLocaleString(),
          className: "sm:w-1/6",
          sortDefaultOrder: "desc",
        },
        {
          name: "rating",
          value: (item) => (
            <SimpleRatingIndicator avgRating={item.bottle.avgRating} />
          ),
          className: "sm:w-1/6",
          sortDefaultOrder: "desc",
          align: "center",
        },
        {
          name: "age",
          value: (item) =>
            item.bottle.statedAge ? (
              <Link
                className="hover:underline"
                href={`/bottles/?age=${item.bottle.statedAge}`}
              >{`${item.bottle.statedAge} years`}</Link>
            ) : null,
          className: "sm:w-1/6",
          sortDefaultOrder: "desc",
        },
      ]}
      {...props}
    />
  );
}
