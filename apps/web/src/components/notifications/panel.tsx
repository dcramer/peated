import { InboxIcon } from "@heroicons/react/20/solid";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import NavLink from "../navLink";
import NotificationCount from "../notificationCount";

export default function NotificationsPanel() {
  return (
    <NavLink href="/notifications">
      <InboxIcon className="h-8 w-8 sm:h-9 sm:w-9" />
      <ErrorBoundary fallback={null}>
        <Suspense>
          <NotificationCount />
        </Suspense>
      </ErrorBoundary>
    </NavLink>
  );
}
