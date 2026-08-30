import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { redirectToAuth } from "@peated/web/lib/auth";
import { isLoggedIn } from "@peated/web/lib/auth.server";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { getServerClient } from "@peated/web/lib/orpc/client.server";

import { NotificationList } from "../notificationList.stylex";

export default async function AllNotificationsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isLoggedIn())) {
    redirectToAuth({ pathname: "/notifications/all" });
  }

  const searchParams = await props.searchParams;
  const input = getApiQueryParams(searchParams, {
    numericFields: ["cursor", "limit"],
    overrides: { filter: "all" },
  });
  const page = Number(input.cursor ?? 1) || 1;
  const { client } = await getServerClient();
  const notificationList = await client.notifications.list(input);

  return (
    <NotificationList
      emptyHeading="No notifications"
      initialNotifications={notificationList.results}
      nextHref={getCursorHref(
        "/notifications/all",
        searchParams,
        notificationList.rel.nextCursor,
      )}
      page={page}
      previousHref={getCursorHref(
        "/notifications/all",
        searchParams,
        notificationList.rel.prevCursor,
      )}
    />
  );
}
