import { XMarkIcon } from "@heroicons/react/20/solid";
import { Link, useNavigate } from "react-router-dom";
import classNames from "../../lib/classNames";
import { Notification } from "../../types";
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
        "p-3",
        link ? "cursor-pointer hover:bg-gray-100" : "",
      )}
      onClick={
        link
          ? () => {
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
            <div className="flex-1">
              <p className="text-sm">
                {notification.fromUser && (
                  <Link
                    to={`/users/${notification.fromUser.id}`}
                    className="mr-1 font-semibold"
                  >
                    {notification.fromUser.displayName}
                  </Link>
                )}
                {getStatusMessage({ notification })}
              </p>
              <NotificationEntryRef notification={notification} />
            </div>
            <div className="flex min-h-full flex-shrink">
              <button
                onClick={onArchive}
                className="hover:text-peated block h-full w-full rounded border-gray-200 bg-inherit p-2 px-1 text-gray-400 hover:bg-gray-200"
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
    case "toast":
      return `/users/${notification.ref.id}`;
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
          toasted your
          <Link
            to={`/tastings/${notification.ref.id}`}
            className="mx-1 font-semibold"
          >
            {notification.ref.bottle.brand.name}
          </Link>
          tasting
        </>
      );
    default:
      return null;
  }
};

const NotificationEntryRef = ({
  notification,
}: {
  notification: Notification;
}) => {
  switch (notification.objectType) {
    case "follow":
      return <FollowEntry notification={notification} />;
    default:
      return null;
  }
};
