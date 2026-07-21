"use client";

import { XMarkIcon } from "@heroicons/react/20/solid";
import type { CatalogTargetV1 } from "@peated/server/schemas";
import type { Notification } from "@peated/server/types";
import Link from "@peated/web/components/link";
import {
  getCatalogTargetLabel,
  getCatalogTargetScopeLabel,
} from "@peated/web/lib/catalogTarget";
import classNames from "@peated/web/lib/classNames";
import { useRouter } from "next/navigation";
import UserAvatar from "../userAvatar";
import FriendRequestEntry from "./friendRequestEntry";

export default function NotificationEntry({
  notification,
  onArchive,
  onMarkRead,
}: {
  notification: Notification;
  onArchive: () => void;
  onMarkRead: () => void;
}) {
  const router = useRouter();
  const link = getLink({ notification });
  return (
    <div
      className={classNames(
        "bg-slate-950 p-3",
        notification.read ? "text-muted" : "text-white",
        link ? "group cursor-pointer rounded hover:bg-slate-700" : "",
      )}
      onClick={
        link
          ? () => {
              onMarkRead();
              router.push(link);
            }
          : undefined
      }
    >
      <div className="flex flex-auto items-start">
        <div className="flex-shrink-0 self-center">
          <UserAvatar user={notification.fromUser} size={32} />
        </div>
        <div className="ml-3 flex w-0 flex-auto flex-col">
          <div className="flex flex-auto">
            <div className="flex flex-auto flex-col justify-center">
              <div className="text-sm">
                {notification.fromUser && (
                  <Link
                    href={`/users/${notification.fromUser.username}`}
                    className="mr-1 inline-flex items-center font-semibold hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/users/${notification.fromUser?.username}`);
                    }}
                  >
                    {notification.fromUser.username}
                  </Link>
                )}
                {getStatusMessage({ notification })}
              </div>
              <NotificationEntryRef
                notification={notification}
                onArchive={onArchive}
              />
            </div>
            <div className="flex min-h-full flex-shrink">
              <button
                aria-label="Dismiss notification"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive();
                }}
                className="group-hover:text-muted block h-full w-full rounded bg-inherit p-2 px-1 text-slate-600 hover:bg-slate-800 hover:text-slate-400"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const getLink = ({ notification }: { notification: Notification }) => {
  switch (notification.type) {
    case "friend_request":
      return notification.fromUser
        ? `/users/${notification.fromUser.username}`
        : null;
    case "comment":
    case "toast":
      if (notification.ref) return `/tastings/${notification.ref.id}`;
      return null;
    default:
      return null;
  }
};

export const getStatusMessage = ({
  notification,
}: {
  notification: Notification;
}) => {
  switch (notification.type) {
    case "friend_request":
      return <>sent you a friend request</>;
    case "toast":
      return (
        <>
          toasted{" "}
          {notification.ref ? (
            <>
              <Link
                href={`/tastings/${notification.ref.id}`}
                className="font-semibold"
              >
                {getCatalogTargetLabel(notification.ref.target)}
              </Link>
              <CatalogTargetScope target={notification.ref.target} />
            </>
          ) : (
            "unknown tasting"
          )}
        </>
      );
    case "comment":
      return (
        <>
          commented on{" "}
          {notification.ref ? (
            <>
              <Link
                href={`/tastings/${notification.ref.id}`}
                className="font-semibold"
              >
                {getCatalogTargetLabel(notification.ref.target)}
              </Link>
              <CatalogTargetScope target={notification.ref.target} />
            </>
          ) : (
            "an unknown tasting"
          )}
        </>
      );
    default:
      return null;
  }
};

const CatalogTargetScope = ({ target }: { target: CatalogTargetV1 }) => {
  if (target.kind === "bottle") return null;

  return (
    <>
      {" "}
      <span className="text-muted text-xs">
        ({getCatalogTargetScopeLabel(target)})
      </span>
    </>
  );
};

const NotificationEntryRef = ({
  notification,
  onArchive,
}: {
  notification: Notification;
  onArchive: () => void;
}) => {
  switch (notification.type) {
    case "friend_request":
      return (
        <FriendRequestEntry notification={notification} onArchive={onArchive} />
      );
    default:
      return null;
  }
};
