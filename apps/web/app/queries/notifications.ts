import type { Paginated } from "@peated/shared/types";
import type { ApiClient } from "~/lib/api";

export async function fetchNotifications(
  api: ApiClient,
  filter: "unread" | string | undefined,
): Promise<Paginated<Notification>> {
  return api.get("/notifications", {
    query: { filter },
  });
}
