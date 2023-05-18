import { Outlet } from "react-router-dom";

import Layout from "../components/layout";
import QueryBoundary from "../components/queryBoundary";
import Tabs from "../components/tabs";

export default function Friends() {
  return (
    <Layout>
      <div>
        <div className="hidden sm:block">
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
        </div>
      </div>
      <QueryBoundary>
        <Outlet />
      </QueryBoundary>
    </Layout>
  );
}
