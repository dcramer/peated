"use client";

import EmptyActivity from "@peated/web/components/emptyActivity";
import NotificationList from "@peated/web/components/notifications/list";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc/client";

export default function Page() {
  useAuthRequired();

  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
    overrides: {
      filter: "unread",
    },
  });
  const [notificationList] =
    trpc.notificationList.useSuspenseQuery(queryParams);

  return notificationList.results.length ? (
    <NotificationList values={notificationList.results} />
  ) : (
    <EmptyActivity>{"You don't have any unread notifications."}</EmptyActivity>
  );
}
