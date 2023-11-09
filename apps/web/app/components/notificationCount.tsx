import useAuth from "~/hooks/useAuth";
import { trpc } from "~/lib/trpc";
import { ClientOnly } from "./clientOnly";

function NotificationCountContent() {
  const { user } = useAuth();
  const { data: unreadNotificationCount } = trpc.notificationCount.useQuery(
    { filter: "unread" },
    {
      staleTime: 60 * 1000,
      enabled: !!user && typeof document !== "undefined",
    },
  );

  if (unreadNotificationCount && unreadNotificationCount.count > 0)
    return (
      <span className="bg-highlight absolute right-0 top-0 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold text-black">
        {unreadNotificationCount.count.toLocaleString()}
      </span>
    );
  return null;
}

export function NotificationCount() {
  return <ClientOnly>{() => <NotificationCountContent />}</ClientOnly>;
}
