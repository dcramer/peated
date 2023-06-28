import { XMarkIcon } from "@heroicons/react/20/solid";
import { Link, useNavigate } from "@remix-run/react";
import classNames from "../../lib/classNames";
import type { Notification } from "../../types";
import UserAvatar from "../userAvatar";
import FollowEntry from "./followEntry";

export default function NotificationEntry({
  notification,
  onArchive,
}: {
  notification: Notification;
  onArchive: () => void;
}) {
  const navigate = useNavigate();
  const link = getLink({ notification });
  return (
    <div
      className={classNames(
        "bg-slate-950 p-3 text-white",
        link ? "group cursor-pointer rounded hover:bg-slate-700" : "",
      )}
      onClick={
        link
          ? () => {
              onArchive();
              navigate(link);
            }
          : undefined
      }
    >
      <div className="flex flex-1 items-start">
        <div className="flex-shrink-0 self-center">
          <UserAvatar user={notification.fromUser} size={32} />
        </div>
        <div className="ml-3 flex w-0 flex-1 flex-col">
          <div className="flex flex-1">
            <div className="flex flex-1 flex-col justify-center">
              <div className="text-sm">
                {notification.fromUser && (
                  <Link
                    to={`/users/${notification.fromUser.username}`}
                    className="mr-1 font-semibold"
                  >
                    {notification.fromUser.displayName}
                  </Link>
                )}
                {getStatusMessage({ notification })}
              </div>
              <NotificationEntryRef
                notification={notification}
                onComplete={onArchive}
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
  switch (notification.objectType) {
    case "follow":
      return `/users/${notification.objectId}`;
    case "comment":
    case "toast":
      return `/tastings/${notification.ref.id}`;
    default:
      return null;
  }
};

const getStatusMessage = ({ notification }: { notification: Notification }) => {
  switch (notification.objectType) {
    case "follow":
      return <>wants to follow you</>;
    case "toast":
      return (
        <>
          toasted
          <Link
            to={`/tastings/${notification.ref.id}`}
            className="mx-1 font-semibold"
          >
            {notification.ref.bottle.brand.name}
          </Link>
        </>
      );
    case "comment":
      return (
        <>
          commented on
          <Link
            to={`/tastings/${notification.ref.id}`}
            className="mx-1 font-semibold"
          >
            {notification.ref.bottle.brand.name}
          </Link>
        </>
      );
    default:
      return null;
  }
};

const NotificationEntryRef = ({
  notification,
  onComplete,
}: {
  notification: Notification;
  onComplete: () => void;
}) => {
  switch (notification.objectType) {
    case "follow":
      return (
        <FollowEntry notification={notification} onComplete={onComplete} />
      );
    default:
      return null;
  }
};
