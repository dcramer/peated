import { Outlet } from "react-router-dom";

import Layout from "../components/layout";
import Tabs from "../components/tabs";

export default function Friends() {
  return (
    <Layout gutter noMobileGutter>
      <div>
        <div className="hidden sm:block">
          <div className="border-b border-slate-700">
            <Tabs fullWidth>
              <Tabs.Item to="/friends" controlled>
                Friends
              </Tabs.Item>
              <Tabs.Item to="/friends/requests" controlled>
                Requests
              </Tabs.Item>
            </Tabs>
          </div>
        </div>
      </div>
      <Outlet />
    </Layout>
  );
}
