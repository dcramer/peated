"use client";

import EmptyActivity from "@peated/web/components/emptyActivity";
import NotificationList from "@peated/web/components/notifications/list";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc/client";
import { useSearchParams } from "next/navigation";

export default function Page() {
  useAuthRequired();

  const searchParams = useSearchParams();
  const [notificationList] = trpc.notificationList.useSuspenseQuery({
    filter: "all",
    ...Object.fromEntries(searchParams.entries()),
  });

  return notificationList.results.length ? (
    <NotificationList values={notificationList.results} />
  ) : (
    <EmptyActivity>{"You don't have any notifications."}</EmptyActivity>
  );
}
