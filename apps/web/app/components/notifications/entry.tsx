import { XMarkIcon } from "@heroicons/react/20/solid";
import type { Notification } from "@peated/server/types";
import { Link, useNavigate } from "@remix-run/react";
import type { FriendRequestNotification } from "~/types";
import classNames from "../../lib/classNames";
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
  const navigate = useNavigate();
  const link = getLink({ notification });
  return (
    <div
      className={classNames(
        "bg-slate-950 p-3",
        notification.read ? "text-light" : "text-white",
        link ? "group cursor-pointer rounded hover:bg-slate-700" : "",
      )}
      onClick={
        link
          ? () => {
              onMarkRead();
              navigate(link);
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
                    to={`/users/${notification.fromUser.username}`}
                    className="mr-1 font-semibold hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/users/${notification.fromUser?.username}`);
                    }}
                  >
                    {notification.fromUser.displayName}
                  </Link>
                )}
                {getStatusMessage({ notification })}
              </div>
              <NotificationEntryRef
                notification={notification}
                onArchive={onArchive}
                onMarkRead={onMarkRead}
              />
            </div>
            <div className="flex min-h-full flex-shrink">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive();
                }}
                className="block h-full w-full rounded bg-inherit p-2 px-1 text-slate-600 hover:bg-slate-800 hover:text-slate-400 group-hover:text-slate-500"
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
      return `/users/${notification.fromUser?.username}`;
    case "comment":
    case "toast":
      if (notification.ref) return `/tastings/${notification.ref.id}`;
      return null;
    default:
      return null;
  }
};

const getStatusMessage = ({ notification }: { notification: Notification }) => {
  switch (notification.type) {
    case "friend_request":
      return <>sent you a friend request</>;
    case "toast":
      return (
        <>
          toasted
          {notification.ref && "bottle" in notification.ref ? (
            <Link
              to={`/tastings/${notification.ref.id}`}
              className="mx-1 font-semibold"
            >
              {notification.ref.bottle.fullName}
            </Link>
          ) : (
            "unknown tasting"
          )}
        </>
      );
    case "comment":
      return (
        <>
          commented on
          {notification.ref && "bottle" in notification.ref ? (
            <Link
              to={`/tastings/${notification.ref.id}`}
              className="mx-1 font-semibold"
            >
              {notification.ref.bottle.fullName}
            </Link>
          ) : (
            "unknown tasting"
          )}
        </>
      );
    default:
      return null;
  }
};

const NotificationEntryRef = ({
  notification,
  onArchive,
  onMarkRead,
}: {
  notification: Notification;
  onArchive: () => void;
  onMarkRead: () => void;
}) => {
  const props = {
    notification,
    onArchive,
    onMarkRead,
  };
  switch (notification.type) {
    case "friend_request":
      return (
        <FriendRequestEntry
          {...props}
          notification={notification as FriendRequestNotification}
        />
      );
    default:
      return null;
  }
};
