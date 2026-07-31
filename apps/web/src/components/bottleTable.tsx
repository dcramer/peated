"use client";

import { formatCategoryName } from "@peated/server/lib/format";
import type { Bottle, CollectionBottle, PagingRel } from "@peated/server/types";
import BottleStatusIcons, {
  BottleStatusIndicators,
} from "@peated/web/components/bottleStatusIcons";
import Link from "@peated/web/components/link";
import type { ComponentProps, ReactNode } from "react";
import BottleIdentity, { getAbsoluteBottleTitle } from "./bottleIdentity";
import BottleRatingSummary from "./bottleRatingSummary";
import SimpleRatingIndicator from "./simpleRatingIndicator";
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
  showRatingSummary = false,
  compactIdentity = false,
  ...props
}: Omit<ComponentProps<typeof Table>, "items" | "rel" | "columns"> & {
  bottleList: (Bottle | CollectionBottle)[];
  rel?: PagingRel;
  renderCollectionBottleImage?: (item: CollectionBottle) => ReactNode;
  renderCollectionBottleMeta?: (item: CollectionBottle) => ReactNode;
  renderCollectionBottleActions?: (item: CollectionBottle) => ReactNode;
  hideLibraryStatus?: boolean;
  showBottleStats?: boolean;
  showRatingSummary?: boolean;
  compactIdentity?: boolean;
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
          className: showRatingSummary
            ? "min-w-full sm:w-auto"
            : showBottleStats
              ? "min-w-full sm:w-1/2"
              : "w-full",
          cellClassName: compactIdentity ? "max-w-0" : undefined,
          value: (item) => {
            const { bottle } = item;
            const categoryName = bottle.category
              ? formatCategoryName(bottle.category)
              : null;
            const identityTitle = getAbsoluteBottleTitle(bottle);
            const showCategory =
              !compactIdentity &&
              categoryName &&
              String(bottle.category) !== "other" &&
              categoryName.toLocaleLowerCase() !==
                identityTitle.toLocaleLowerCase();
            const collectionImage =
              item.collectionBottle &&
              renderCollectionBottleImage?.(item.collectionBottle);
            const collectionMeta =
              item.collectionBottle &&
              renderCollectionBottleMeta?.(item.collectionBottle);
            const mobileCollectionActions =
              item.collectionBottle &&
              renderCollectionBottleActions?.(item.collectionBottle);
            const statusIndicators = item.collectionBottle ? (
              <BottleStatusIndicators
                hasTasted={item.collectionBottle.hasTasted}
                isLibrary={false}
              />
            ) : (
              <BottleStatusIcons
                bottle={bottle}
                hideLibrary={hideLibraryStatus}
              />
            );
            const categoryLink = showCategory ? (
              <Link
                href={`/bottles/?category=${bottle.category}`}
                className="hover:underline"
              >
                {categoryName}
              </Link>
            ) : null;

            return (
              <div className="flex min-w-0 items-start gap-3">
                {collectionImage}
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <BottleIdentity
                    bottle={bottle}
                    mode="absolute"
                    metadataVariant={compactIdentity ? "summary" : "full"}
                    showBrand={!props.groupBy}
                  />
                  <div className="text-muted mt-1 flex min-w-0 flex-wrap items-center gap-x-1 text-sm">
                    {statusIndicators}
                    {collectionMeta}
                    {collectionMeta && categoryLink ? (
                      <span aria-hidden="true">&middot;</span>
                    ) : null}
                    {categoryLink}
                  </div>
                </div>
                {showRatingSummary ? (
                  <BottleRatingSummary
                    avgRating={bottle.avgRating}
                    totalRatings={bottle.ratingStats.total}
                    className="w-20 sm:hidden"
                  />
                ) : null}
                {mobileCollectionActions && (
                  <div className="ml-auto shrink-0 sm:hidden">
                    {mobileCollectionActions}
                  </div>
                )}
              </div>
            );
          },
        },
        ...(showRatingSummary
          ? [
              {
                name: "rating-summary",
                title: "Rating",
                value: (item: BottleRow) => (
                  <BottleRatingSummary
                    avgRating={item.bottle.avgRating}
                    totalRatings={item.bottle.ratingStats.total}
                  />
                ),
                className: "sm:w-24",
                align: "center" as const,
              },
            ]
          : []),
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
                className:
                  showBottleStats || showRatingSummary ? "sm:w-16" : "sm:w-36",
              },
            ]
          : []),
      ]}
      {...props}
    />
  );
}
