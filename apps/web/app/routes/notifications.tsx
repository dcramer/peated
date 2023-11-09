import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, useLocation } from "@remix-run/react";
import { type SitemapFunction } from "remix-sitemap";
import EmptyActivity from "~/components/emptyActivity";
import Layout from "~/components/layout";
import NotificationList from "~/components/notifications/list";
import Tabs from "~/components/tabs";
import { redirectToAuth } from "~/lib/auth.server";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export async function loader({
  context: { trpc, user },
  request,
}: LoaderFunctionArgs) {
  if (!user) return redirectToAuth({ request });

  const { searchParams } = new URL(request.url);

  return json({
    notificationList: await trpc.notificationList.query({
      filter: "unread",
      ...Object.fromEntries(searchParams.entries()),
    }),
  });
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
  const { notificationList } = useLoaderData<typeof loader>();

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

      {notificationList && notificationList.results.length ? (
        <NotificationList values={notificationList.results} />
      ) : (
        <EmptyActivity>You don't have any unread notifications.</EmptyActivity>
      )}
    </Layout>
  );
}
