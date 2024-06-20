import { InboxIcon } from "@heroicons/react/20/solid";
import { Fragment } from "react";

import NavLink from "../navLink";
import { NotificationCount } from "../notificationCount";
import QueryBoundary from "../queryBoundary";

export default function NotificationsPanel() {
  return (
    <NavLink href="/notifications">
      <InboxIcon className="h-8 w-8 sm:h-9 sm:w-9" />
      <QueryBoundary fallback={() => null} loading={<Fragment />}>
        <NotificationCount />
      </QueryBoundary>
    </NavLink>
  );
}
