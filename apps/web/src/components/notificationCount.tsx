"use client";

import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useQuery } from "@tanstack/react-query";

function NotificationCountAuthentciated() {
  const { user } = useAuth();
  // TODO: handle unauthenticated gracefully here
  const orpc = useORPC();
  const { data: unreadNotificationCount } = useQuery({
    ...orpc.notifications.count.queryOptions({
      input: { filter: "unread" },
    }),
    enabled: !!user,
    select: (data) => data.count,
    staleTime: 60 * 1000,
  });

  if (!user) return null;

  if (unreadNotificationCount > 0) {
    return (
      <span className="bg-highlight absolute right-0 top-0 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold text-black">
        {unreadNotificationCount.toLocaleString()}
      </span>
    );
  }

  return null;
}

export default function NotificationCount() {
  const { user } = useAuth();

  if (!user) return null;

  return <NotificationCountAuthentciated />;
}
