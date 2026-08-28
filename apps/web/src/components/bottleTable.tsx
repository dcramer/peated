"use client";

import type { Bottle, CollectionBottle, PagingRel } from "@peated/server/types";
import BottleStatusIcons, {
  BottleStatusIndicators,
} from "@peated/web/components/bottleStatusIcons";
import Link from "@peated/web/components/link";
import ReviewScoreDisplay from "@peated/web/components/reviewScoreDisplay";
import type { ComponentProps, ReactNode } from "react";
import BottleIdentity from "./bottleIdentity";
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
  groupBy,
  groupItem,
  groupTo,
  ...props
}: Omit<
  ComponentProps<typeof Table<BottleRow, Bottle["brand"]>>,
  "items" | "rel" | "columns" | "groupBy" | "groupItem" | "groupTo"
> & {
  bottleList: (Bottle | CollectionBottle)[];
  rel?: PagingRel;
  renderCollectionBottleImage?: (item: CollectionBottle) => ReactNode;
  renderCollectionBottleMeta?: (item: CollectionBottle) => ReactNode;
  renderCollectionBottleActions?: (item: CollectionBottle) => ReactNode;
  hideLibraryStatus?: boolean;
  showBottleStats?: boolean;
  showRatingSummary?: boolean;
  compactIdentity?: boolean;
  groupBy?: (item: Bottle) => Bottle["brand"];
  groupItem?: (item: Bottle["brand"]) => ReactNode;
  groupTo?: (group: Bottle["brand"]) => string;
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
    <Table<BottleRow, Bottle["brand"]>
      items={rows}
      primaryKey={(item) => item.key}
      rel={rel}
      groupBy={groupBy ? (item) => groupBy(item.bottle) : undefined}
      groupItem={groupItem}
      groupTo={groupTo}
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
            return (
              <div className="flex min-w-0 items-start gap-3">
                {collectionImage}
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <BottleIdentity
                    bottle={bottle}
                    mode="absolute"
                    metadataVariant={compactIdentity ? "summary" : "full"}
                    showBrand={!groupBy}
                    trailingContent={statusIndicators}
                    hideAgeOnDesktop={showBottleStats}
                  />
                  {collectionMeta ? (
                    <div className="text-muted mt-1 flex min-w-0 flex-wrap items-center gap-x-1 text-sm">
                      {collectionMeta}
                    </div>
                  ) : null}
                </div>
                {showRatingSummary ? (
                  bottle.medianScore !== null ? (
                    <ReviewScoreDisplay
                      score={bottle.medianScore}
                      showBand={false}
                      className="w-20 justify-end text-sm sm:hidden"
                    />
                  ) : null
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
                value: (item: BottleRow) =>
                  item.bottle.medianScore !== null ? (
                    <ReviewScoreDisplay
                      score={item.bottle.medianScore}
                      count={item.bottle.scoreCount}
                      showBand={false}
                    />
                  ) : null,
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
                value: (item: BottleRow) =>
                  item.bottle.medianScore !== null ? (
                    <ReviewScoreDisplay
                      score={item.bottle.medianScore}
                      showBand={false}
                    />
                  ) : null,
                className: "sm:w-20",
                sortDefaultOrder: "desc" as const,
                align: "center" as const,
              },
              {
                name: "age",
                value: (item: BottleRow) => {
                  const { statedAge, noAgeStatement } = item.bottle;
                  return statedAge !== null ? (
                    <Link
                      className="hover:underline"
                      href={`/bottles/?age=${statedAge}`}
                    >{`${statedAge} years`}</Link>
                  ) : noAgeStatement === true ? (
                    <span
                      aria-label="No age statement"
                      title="No age statement"
                    >
                      NAS
                    </span>
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
