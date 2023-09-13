import type { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLocation } from "@remix-run/react";
import { QueryClient, dehydrate, useQuery } from "@tanstack/react-query";
import EmptyActivity from "~/components/emptyActivity";
import Layout from "~/components/layout";
import NotificationList from "~/components/notifications/list";
import Tabs from "~/components/tabs";
import useApi from "~/hooks/useApi";
import { fetchNotifications } from "~/queries/notifications";

export async function loader({ context, request }: LoaderArgs) {
  const location = new URL(request.url);
  const filter = location.searchParams.get("filter") || "unread";

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(["notifications", filter], () =>
    fetchNotifications(context.api, filter),
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
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const filter = qs.get("filter") || "unread";

  const api = useApi();
  const { data } = useQuery(["notifications", filter], () =>
    fetchNotifications(api, filter),
  );

  return (
    <Layout>
      <Tabs>
        <Tabs.Item
          as={Link}
          active={filter === "unread"}
          to={{
            pathname: "/notifications",
          }}
        >
          Unread
        </Tabs.Item>
        <Tabs.Item
          as={Link}
          active={filter === "all"}
          to={{
            pathname: "/notifications",
            search: "?filter=all",
          }}
        >
          All
        </Tabs.Item>
      </Tabs>

      {data && data.results.length ? (
        <NotificationList values={data.results} />
      ) : (
        <EmptyActivity>You don't have any unread notifications.</EmptyActivity>
      )}
    </Layout>
  );
}
