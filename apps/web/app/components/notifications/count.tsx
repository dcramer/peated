import { useQuery } from "@tanstack/react-query";

import useApi from "~/hooks/useApi";
import useAuth from "~/hooks/useAuth";
import { ClientOnly } from "../clientOnly";

function NotificationCountContent() {
  const { user } = useAuth();
  const api = useApi();

  const { data: unreadNotificationCount } = useQuery(
    ["notifications", "count", "unread"],
    async (): Promise<number> => {
      const result = await api.get("/notifications", {
        query: {
          filter: "unread",
        },
      });
      return result.results.length;
    },
    {
      staleTime: 60 * 1000,
      enabled: !!user && typeof document !== "undefined",
    },
  );

  if (unreadNotificationCount && unreadNotificationCount > 0)
    return (
      <span className="bg-highlight absolute right-0 top-0 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold text-black">
        {unreadNotificationCount.toLocaleString()}
      </span>
    );
  return null;
}

export function NotificationCount() {
  return <ClientOnly>{() => <NotificationCountContent />}</ClientOnly>;
}
