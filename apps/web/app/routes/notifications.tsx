import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLocation } from "@remix-run/react";
import { QueryClient, dehydrate, useQuery } from "@tanstack/react-query";
import { type SitemapFunction } from "remix-sitemap";
import EmptyActivity from "~/components/emptyActivity";
import Layout from "~/components/layout";
import NotificationList from "~/components/notifications/list";
import Tabs from "~/components/tabs";
import useApi from "~/hooks/useApi";
import { redirectToAuth } from "~/lib/auth.server";
import { fetchNotifications } from "~/queries/notifications";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export async function loader({ context, request }: LoaderFunctionArgs) {
  if (!context.user) return redirectToAuth({ request });

  const location = new URL(request.url);
  const filter = location.searchParams.get("filter") || "unread";

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(["notifications", filter], () =>
    fetchNotifications(context.api, filter),
  );

  return json({ dehydratedState: dehydrate(queryClient) });
}

export const meta: MetaFunction = () => {
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
      <Tabs fullWidth>
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
