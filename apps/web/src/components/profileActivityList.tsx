"use client";

import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import Link from "@peated/web/components/link";
import {
  formatBottlingName,
  getBottleBottlingPath,
} from "@peated/web/lib/bottlings";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import TastingListItem from "./tastingListItem";
import TimeSince from "./timeSince";
import UserAvatar from "./userAvatar";

type ProfileActivityListResult = Outputs["users"]["activity"]["list"];
type ProfileActivityEntry = ProfileActivityListResult["results"][number];
type ProfileCollectionAddActivity = Extract<
  ProfileActivityEntry,
  { type: "collection_add" }
>;
type ProfileCollectionAddItem = ProfileCollectionAddActivity["items"][number];

function formatBottleCount(count: number) {
  return `${count.toLocaleString()} bottle${count === 1 ? "" : "s"}`;
}

function getCollectionLabel(activity: ProfileCollectionAddActivity) {
  if (activity.collection.href?.endsWith("/favorites")) {
    return "Favorites";
  }
  return activity.collection.name;
}

function CollectionLink({
  activity,
}: {
  activity: ProfileCollectionAddActivity;
}) {
  const label = getCollectionLabel(activity);

  if (!activity.collection.href) {
    return <span className="font-semibold text-white">{label}</span>;
  }

  return (
    <Link
      href={activity.collection.href}
      className="font-semibold text-white hover:underline"
    >
      {label}
    </Link>
  );
}

function getCollectionItemHref(item: ProfileCollectionAddItem) {
  if (item.release) {
    return getBottleBottlingPath(item.bottle.id, item.release.id);
  }
  return `/bottles/${item.bottle.id}`;
}

function getCollectionItemTitle(item: ProfileCollectionAddItem) {
  return item.release?.fullName ?? item.bottle.fullName;
}

function getCollectionItemDetail(item: ProfileCollectionAddItem) {
  if (item.release) {
    const bottlingName = formatBottlingName(item.release);
    return bottlingName && bottlingName !== item.release.fullName
      ? bottlingName
      : item.bottle.fullName;
  }

  return item.bottle.category ? formatCategoryName(item.bottle.category) : null;
}

function CollectionItemImage({ item }: { item: ProfileCollectionAddItem }) {
  const imageUrl =
    item.imageUrl ??
    item.release?.imageUrl ??
    item.bottle.displayImageUrl ??
    item.bottle.imageUrl;

  if (!imageUrl) {
    return null;
  }

  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded border border-slate-800 bg-slate-900">
      <img
        src={imageUrl}
        alt=""
        className="h-full w-full object-cover"
        aria-hidden="true"
      />
    </div>
  );
}

function CollectionPreviewItem({ item }: { item: ProfileCollectionAddItem }) {
  const detail = getCollectionItemDetail(item);

  return (
    <li className="flex min-w-0 items-center gap-x-3 px-3 py-2">
      <CollectionItemImage item={item} />
      <div className="min-w-0 flex-1">
        <Link
          href={getCollectionItemHref(item)}
          className="block truncate text-sm font-semibold text-white hover:underline"
          title={getCollectionItemTitle(item)}
        >
          {getCollectionItemTitle(item)}
        </Link>
        {detail ? (
          <div className="text-muted truncate text-xs">{detail}</div>
        ) : null}
      </div>
    </li>
  );
}

function CollectionAddActivityItem({
  activity,
}: {
  activity: ProfileCollectionAddActivity;
}) {
  const remainingCount = activity.totalItems - activity.items.length;

  return (
    <li className="-mt-1 overflow-hidden border border-slate-800 bg-slate-950/80">
      <div className="flex items-start gap-x-3 px-3 py-3 lg:px-5">
        <UserAvatar size={32} user={activity.createdBy} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col gap-y-1 sm:flex-row sm:items-start sm:justify-between sm:gap-x-4">
            <div className="min-w-0 break-words text-sm leading-6">
              <Link
                href={`/users/${activity.createdBy.username}`}
                className="font-semibold text-white hover:underline"
              >
                {activity.createdBy.username}
              </Link>{" "}
              <span className="text-muted">
                added {formatBottleCount(activity.totalItems)} to{" "}
              </span>
              <CollectionLink activity={activity} />
            </div>
            <TimeSince
              className="font-muted shrink-0 text-xs sm:text-sm"
              date={activity.createdAt}
            />
          </div>

          {activity.items.length > 0 ? (
            <ul className="mt-3 divide-y divide-slate-800 overflow-hidden rounded border border-slate-800/80 bg-slate-950">
              {activity.items.map((item) => (
                <CollectionPreviewItem key={item.id} item={item} />
              ))}
              {remainingCount > 0 ? (
                <li className="text-muted px-3 py-2 text-xs font-semibold">
                  +{remainingCount.toLocaleString()} more
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default function ProfileActivityList({
  values,
}: {
  values: ProfileActivityListResult["results"];
}) {
  const [deletedTastingIds, setDeletedTastingIds] = useState<number[]>([]);

  return (
    <ul className="mt-1">
      <AnimatePresence>
        {values.map((activity) => {
          switch (activity.type) {
            case "tasting":
              if (deletedTastingIds.includes(activity.tasting.id)) {
                return null;
              }
              return (
                <TastingListItem
                  key={activity.id}
                  tasting={activity.tasting}
                  onDelete={(tasting) => {
                    setDeletedTastingIds((ids) => [...ids, tasting.id]);
                  }}
                />
              );
            case "collection_add":
              return (
                <CollectionAddActivityItem
                  key={activity.id}
                  activity={activity}
                />
              );
          }
        })}
      </AnimatePresence>
    </ul>
  );
}
