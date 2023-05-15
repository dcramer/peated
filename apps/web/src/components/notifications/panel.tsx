import { Popover } from "@headlessui/react";
import { InboxIcon } from "@heroicons/react/20/solid";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { Notification } from "../../types";
import Spinner from "../spinner";
import NotificationList from "./list";

const EmptyActivity = () => {
  return (
    <div className="mx-auto flex flex-col items-center p-4">
      <span className="block font-light text-gray-400">
        You don't have any unread notifications.
      </span>
    </div>
  );
};

export default function NotificationsPanel() {
  const [notificationList, setNotificationList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { results } = await api.get("/notifications", {
        query: { filter: "unread" },
      });
      setNotificationList(results);
      setLoading(false);
    })();
  }, []);

  const unreadNotificationCount = notificationList.filter(
    (n) => !n.read,
  ).length;

  return (
    <Popover as="div" className="relative mr-4">
      <Popover.Button className="bg-peated focus:ring-offset-peated relative flex max-w-xs items-center rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2">
        <span className="sr-only">Open user menu</span>
        <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded text-white sm:h-10 sm:w-10">
          <InboxIcon className="h-8 w-8" />
        </span>
        {unreadNotificationCount > 0 && (
          <div className="absolute -right-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unreadNotificationCount.toLocaleString()}
          </div>
        )}
      </Popover.Button>
      <Popover.Panel className="absolute right-0 z-10 mt-2 w-96 origin-top-right rounded bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
        <div className="max-h-screen w-full shrink divide-y divide-gray-200 overflow-y-auto text-sm font-semibold leading-6">
          {loading ? (
            <Spinner />
          ) : notificationList.length ? (
            <>
              <Link
                className="flex w-full px-4 py-2 text-gray-700 hover:bg-gray-200"
                to={`/notifications`}
              >
                View All Notifications
              </Link>
              <NotificationList values={notificationList} />
            </>
          ) : (
            <EmptyActivity />
          )}
        </div>
      </Popover.Panel>
    </Popover>
  );
}
