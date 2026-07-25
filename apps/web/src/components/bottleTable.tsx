"use client";

import { formatCategoryName } from "@peated/server/lib/format";
import type { Bottle, CollectionBottle, PagingRel } from "@peated/server/types";
import BottleStatusIcons, {
  BottleStatusIndicators,
} from "@peated/web/components/bottleStatusIcons";
import Link from "@peated/web/components/link";
import type { ComponentProps, ReactNode } from "react";
import classNames from "../lib/classNames";
import BottleLink from "./bottleLink";
import SimpleRatingIndicator from "./simpleRatingIndicator";
import SingleCaskChip from "./singleCaskChip";
import Table from "./table";

type BottleRow = {
  bottle: Bottle;
  collectionBottle?: CollectionBottle;
  key: string;
};

/**
 * Renders bottle rows and lets collection callers attach row-scoped controls
 * when the source item is a CollectionBottle.
 */
export default function BottleTable({
  bottleList,
  rel,
  renderCollectionBottleImage,
  renderCollectionBottleMeta,
  renderCollectionBottleActions,
  hideLibraryStatus = false,
  showBottleStats = true,
  ...props
}: Omit<ComponentProps<typeof Table>, "items" | "rel" | "columns"> & {
  bottleList: (Bottle | CollectionBottle)[];
  rel?: PagingRel;
  renderCollectionBottleImage?: (item: CollectionBottle) => ReactNode;
  renderCollectionBottleMeta?: (item: CollectionBottle) => ReactNode;
  renderCollectionBottleActions?: (item: CollectionBottle) => ReactNode;
  hideLibraryStatus?: boolean;
  showBottleStats?: boolean;
}) {
  const rows: BottleRow[] = bottleList.map((item) =>
    "bottle" in item
      ? {
          bottle: item.bottle,
          collectionBottle: item,
          key: `collection-${item.id}`,
        }
      : { bottle: item, key: `bottle-${item.id}` },
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
          className: showBottleStats ? "min-w-full sm:w-1/2" : "w-full",
          value: (item) => {
            const { bottle } = item;
            const collectionImage =
              item.collectionBottle &&
              renderCollectionBottleImage?.(item.collectionBottle);
            const collectionMeta =
              item.collectionBottle &&
              renderCollectionBottleMeta?.(item.collectionBottle);
            const mobileCollectionActions =
              item.collectionBottle &&
              renderCollectionBottleActions?.(item.collectionBottle);

            return (
              <div
                className={classNames(
                  "min-w-0",
                  collectionImage
                    ? "flex items-start gap-3"
                    : "flex flex-col justify-center gap-y-2",
                )}
              >
                {collectionImage}
                <div
                  className={classNames(
                    "min-w-0",
                    collectionImage
                      ? "flex flex-1 flex-col justify-center gap-y-2"
                      : "flex flex-col justify-center gap-y-2",
                  )}
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-x-1">
                    <BottleLink
                      bottle={bottle}
                      className="font-medium hover:underline"
                    >
                      {bottle.fullName}
                    </BottleLink>
                    {item.collectionBottle ? (
                      <BottleStatusIndicators
                        hasTasted={item.collectionBottle.hasTasted}
                        isLibrary={false}
                      />
                    ) : (
                      <BottleStatusIcons
                        bottle={bottle}
                        hideLibrary={hideLibraryStatus}
                      />
                    )}
                    {collectionMeta}
                    {bottle.singleCask && <SingleCaskChip />}
                  </div>
                  <div className="text-muted flex flex-col gap-y-1 text-sm">
                    {bottle.category && String(bottle.category) !== "other" && (
                      <Link
                        href={`/bottles/?category=${bottle.category}`}
                        className="hover:underline"
                      >
                        {formatCategoryName(bottle.category)}
                      </Link>
                    )}
                  </div>
                </div>
                {mobileCollectionActions && (
                  <div className="ml-auto shrink-0 sm:hidden">
                    {mobileCollectionActions}
                  </div>
                )}
              </div>
            );
          },
        },
        ...(showBottleStats
          ? [
              {
                name: "tastings",
                value: (item: BottleRow) =>
                  item.bottle.totalTastings.toLocaleString(),
                className: "sm:w-24",
                sortDefaultOrder: "desc" as const,
              },
              {
                name: "rating",
                value: (item: BottleRow) => (
                  <SimpleRatingIndicator
                    avgRating={item.bottle.avgRating ?? null}
                  />
                ),
                className: "sm:w-20",
                sortDefaultOrder: "desc" as const,
                align: "center" as const,
              },
              {
                name: "age",
                value: (item: BottleRow) => {
                  const { statedAge } = item.bottle;
                  return statedAge ? (
                    <Link
                      className="hover:underline"
                      href={`/bottles/?age=${statedAge}`}
                    >{`${statedAge} years`}</Link>
                  ) : null;
                },
                className: "sm:w-24",
                sortDefaultOrder: "desc" as const,
              },
            ]
          : []),
        ...(renderCollectionBottleActions
          ? [
              {
                name: "actions",
                title: "",
                align: "right" as const,
                value: (item: BottleRow) => {
                  const collectionActions =
                    item.collectionBottle &&
                    renderCollectionBottleActions(item.collectionBottle);

                  return collectionActions ? (
                    <div className="hidden justify-end sm:flex">
                      {collectionActions}
                    </div>
                  ) : null;
                },
                className: showBottleStats ? "sm:w-16" : "sm:w-36",
              },
            ]
          : []),
      ]}
      {...props}
    />
  );
}
