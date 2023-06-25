import type { V2_MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

import Layout from "~/components/layout";
import QueryBoundary from "~/components/queryBoundary";
import Tabs from "~/components/tabs";

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
      <div className="border-b border-slate-700">
        <Tabs fullWidth>
          <Tabs.Item to="/friends" controlled>
            Following
          </Tabs.Item>
          <Tabs.Item to="/friends/followers" controlled>
            Followers
          </Tabs.Item>
        </Tabs>
      </div>
      <QueryBoundary>
        <Outlet />
      </QueryBoundary>
    </Layout>
  );
}
