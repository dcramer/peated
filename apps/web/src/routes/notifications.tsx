import EmptyActivity from "../components/emptyActivity";
import Layout from "../components/layout";
import NotificationList from "../components/notifications/list";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api from "../lib/api";
import type { Notification, Paginated } from "../types";

export default function Notifications() {
  const { data } = useSuspenseQuery(
    ["notifications", "unread"],
    (): Promise<Paginated<Notification>> =>
      api.get("/notifications", {
        query: {
          filter: "unread",
        },
      }),
  );

  return (
    <Layout title="Notifications">
      {data.results.length ? (
        <NotificationList values={data.results} />
      ) : (
        <EmptyActivity>You don't have any unread notifications.</EmptyActivity>
      )}
    </Layout>
  );
}
