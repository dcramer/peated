import { InboxIcon } from "@heroicons/react/20/solid";
import { Fragment } from "react";

import NavLink from "../navLink";
import QueryBoundary from "../queryBoundary";
import { NotificationCount } from "./count";

export default function NotificationsPanel() {
  return (
    <NavLink to="/notifications">
      <InboxIcon className="h-8 w-8 sm:h-9 sm:w-9" />
      <QueryBoundary fallback={() => null} loading={<Fragment />}>
        <NotificationCount />
      </QueryBoundary>
    </NavLink>
  );
}
