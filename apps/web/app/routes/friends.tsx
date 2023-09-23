import type { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { Link, Outlet } from "@remix-run/react";

import Layout from "~/components/layout";
import QueryBoundary from "~/components/queryBoundary";
import Tabs from "~/components/tabs";
import { redirectToAuth } from "~/lib/auth.server";

export async function loader({ context, request }: LoaderArgs) {
  if (!context.user) return redirectToAuth({ request });

  return null;
}

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "Friends",
    },
  ];
};

export default function Friends() {
  return (
    <Layout>
      <Tabs fullWidth border>
        <Tabs.Item as={Link} to="/friends" controlled>
          All
        </Tabs.Item>
      </Tabs>
      <QueryBoundary>
        <Outlet />
      </QueryBoundary>
    </Layout>
  );
}
