import type { Paginated } from "@peated/shared/types";
import type { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { QueryClient, dehydrate, useQuery } from "@tanstack/react-query";
import EmptyActivity from "~/components/emptyActivity";
import Layout from "~/components/layout";
import NotificationList from "~/components/notifications/list";
import useApi from "~/hooks/useApi";
import type { Notification } from "~/types";

export async function loader({ context }: LoaderArgs) {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(
    ["notifications", "unread"],
    (): Promise<Paginated<Notification>> =>
      context.api.get("/notifications", {
        query: {
          filter: "unread",
        },
      }),
  );

  return json({ dehydratedState: dehydrate(queryClient) });
}

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "Notifications",
    },
  ];
};

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
    <Layout>
      {data && data.results.length ? (
        <NotificationList values={data.results} />
      ) : (
        <EmptyActivity>You don't have any unread notifications.</EmptyActivity>
      )}
    </Layout>
  );
}
