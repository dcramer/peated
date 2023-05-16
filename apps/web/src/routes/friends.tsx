import { Outlet, useLocation } from "react-router-dom";

import Layout from "../components/layout";
import Tabs from "../components/tabs";

export default function Friends() {
  const location = useLocation();
  return (
    <Layout gutter noMobileGutter>
      <div>
        <div className="hidden sm:block">
          <div className="border-b border-slate-700">
            <Tabs fullWidth>
              <Tabs.Item
                to="/friends"
                active={location.pathname === "/friends"}
              >
                Friends
              </Tabs.Item>
              <Tabs.Item
                to="/friends/requests"
                active={location.pathname === "/friends/requests"}
              >
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
