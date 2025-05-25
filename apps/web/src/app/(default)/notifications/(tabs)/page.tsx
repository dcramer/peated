"use client";

import EmptyActivity from "@peated/web/components/emptyActivity";
import NotificationList from "@peated/web/components/notifications/list";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page() {
  useAuthRequired();

  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
    overrides: {
      filter: "unread",
    },
  });

  const orpc = useORPC();
  const { data: notificationList } = useSuspenseQuery(
    orpc.notifications.list.queryOptions({
      input: queryParams,
    }),
  );

  return notificationList.results.length ? (
    <NotificationList values={notificationList.results} />
  ) : (
    <EmptyActivity>{"You don't have any unread notifications."}</EmptyActivity>
  );
}
