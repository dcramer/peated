"use client";

import type { Outputs } from "@peated/server/orpc/router";
import BottleIdentity from "@peated/web/components/bottleIdentity";
import Link from "@peated/web/components/link";
import TastingSessionListItem from "./tastingSessionListItem";
import TimeSince from "./timeSince";
import UserAvatar from "./userAvatar";

type ActivityListResult = Outputs["activity"]["list"];
type ActivityEntry = ActivityListResult["results"][number];
type CollectionAddActivity = Extract<ActivityEntry, { type: "collection_add" }>;
type CollectionAddItem = CollectionAddActivity["items"][number];

export function filterFavoriteActivity(values: ActivityListResult["results"]) {
  return values.filter(
    (activity) =>
      activity.type !== "collection_add" ||
      !activity.collection.href?.endsWith("/favorites"),
  );
}

function formatBottleCount(count: number) {
  return `${count.toLocaleString()} bottle${count === 1 ? "" : "s"}`;
}

function CollectionLink({ activity }: { activity: CollectionAddActivity }) {
  const label = activity.collection.name;

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

function CollectionItemImage({ item }: { item: CollectionAddItem }) {
  const imageUrl = item.imageUrl ?? item.bottle.imageUrl;

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

function CollectionPreviewItem({ item }: { item: CollectionAddItem }) {
  return (
    <li className="flex min-w-0 items-center gap-x-3 px-3 py-2">
      <CollectionItemImage item={item} />
      <div className="min-w-0 flex-1 text-sm">
        <BottleIdentity
          bottle={item.bottle}
          mode="absolute"
          metadataVariant="summary"
        />
      </div>
    </li>
  );
}

function CollectionAddActivityItem({
  activity,
}: {
  activity: CollectionAddActivity;
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

export default function ActivityList({
  values,
}: {
  values: ActivityListResult["results"];
}) {
  return (
    <ul className="mt-1">
      {values.map((activity) => {
        switch (activity.type) {
          case "tasting_session":
            return (
              <TastingSessionListItem key={activity.id} session={activity} />
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
    </ul>
  );
}
