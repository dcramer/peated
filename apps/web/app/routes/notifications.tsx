import type { LoaderArgs} from "@remix-run/node";
import { json } from "@remix-run/node";
import { QueryClient, dehydrate, useQuery } from "@tanstack/react-query";
import EmptyActivity from "~/components/emptyActivity";
import Layout from "~/components/layout";
import NotificationList from "~/components/notifications/list";
import useApi from "~/hooks/useApi";
import { defaultClient } from "~/lib/api";
import { authMiddleware } from "~/services/auth.server";
import type { Notification, Paginated } from "~/types";

export async function loader({ request }: LoaderArgs) {
  const intercept = await authMiddleware({ request });
  if (intercept) return intercept;

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(
    ["notifications", "unread"],
    (): Promise<Paginated<Notification>> =>
      defaultClient.get("/notifications", {
        query: {
          filter: "unread",
        },
      }),
  );

  return json({ dehydratedState: dehydrate(queryClient) });
}

export default function Notifications() {
  const api = useApi();
  const { data } = useQuery(
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
      {data && data.results.length ? (
        <NotificationList values={data.results} />
      ) : (
        <EmptyActivity>You don't have any unread notifications.</EmptyActivity>
      )}
    </Layout>
  );
}
