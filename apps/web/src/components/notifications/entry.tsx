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
  return (
    <div className="p-4">
      <div className="flex flex-1 items-start">
        <div className="flex-shrink-0 pt-0.5">
          <UserAvatar user={notification.fromUser} size={36} />
        </div>
        <div className="ml-3 flex w-0 flex-1 flex-col gap-y-2">
          <div className="flex flex-1">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {notification.fromUser?.displayName || "Unknown User"}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {getStatusMessage({ notification })}
              </p>
            </div>
            <div className="flex min-h-full flex-shrink">
              <button
                onClick={onArchive}
                className="hover:text-peated block h-full w-full rounded border-gray-200 bg-white p-3 text-gray-400 hover:bg-gray-200"
              >
                X
              </button>
            </div>
          </div>
          <div>
            <NotificationEntryRef notification={notification} />
          </div>
        </div>
      </div>
    </div>
  );
}

const getStatusMessage = ({ notification }: { notification: Notification }) => {
  switch (notification.objectType) {
    case "follow":
      return <>Wants to follow you</>;
    case "toast":
      return <>Toasted your tasting</>;
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
