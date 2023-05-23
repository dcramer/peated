import { InboxIcon } from "@heroicons/react/20/solid";
import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import api from "../../lib/api";
import { Notification, Paginated } from "../../types";
import NavLink from "../navLink";

const NotificationCount = () => {
  const { data } = useQuery(
    ["notifications", "unread"],
    (): Promise<Paginated<Notification>> =>
      api.get("/notifications", {
        query: {
          filter: "unread",
        },
      }),
  );

  const unreadNotificationCount = (data && data.results.length) || 0;

  if (unreadNotificationCount > 0)
    return (
      <div className="bg-highlight absolute right-0 top-0 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold text-black">
        {unreadNotificationCount.toLocaleString()}
      </div>
    );
  return null;
};

export default function NotificationsPanel() {
  return (
    <NavLink to="/notifications">
      <InboxIcon className="h-8 w-8 sm:h-9 sm:w-9" />
      <Suspense>
        <NotificationCount />
      </Suspense>
    </NavLink>
  );
}
