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

  if (!user || !unreadNotificationCount) return null;

  return (
    <span className="absolute top-0 right-0 inline-flex h-5 w-5 items-center justify-center rounded-full bg-highlight font-semibold text-black text-xs">
      {unreadNotificationCount.toLocaleString()}
    </span>
  );
}

export default function NotificationCount() {
  const { user } = useAuth();

  if (!user) return null;

  return <NotificationCountAuthentciated />;
}
