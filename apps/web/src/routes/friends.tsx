import { Outlet, useLocation } from "react-router-dom";

import { Link } from "react-router-dom";
import Layout from "../components/layout";
import classNames from "../lib/classNames";

export default function Friends() {
  const location = useLocation();
  const activeStyles = "text-highlight border-highlight";
  const inactiveStyles =
    "border-transparent text-slate-700 hover:border-slate-500 hover:text-slate-500";
  return (
    <Layout gutter noMobileGutter>
      <div>
        <div className="hidden sm:block">
          <div className="border-b border-slate-700">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <Link
                to="/friends"
                className={classNames(
                  location.pathname === "/friends"
                    ? activeStyles
                    : inactiveStyles,
                  "flex whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium",
                )}
              >
                Friends
                {/* {tab.count ? (
                  <span
                    className={classNames(
                      "bg-indigo-100 text-indigo-600",
                      "ml-3 hidden rounded-full px-2.5 py-0.5 text-xs font-medium md:inline-block",
                    )}
                  >
                    {tab.count}
                  </span>
                ) : null} */}
              </Link>
              <Link
                to="/friends/requests"
                className={classNames(
                  location.pathname === "/friends/requests"
                    ? activeStyles
                    : inactiveStyles,
                  "flex whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium",
                )}
              >
                Requests
              </Link>
            </nav>
          </div>
        </div>
      </div>
      <Outlet />
    </Layout>
  );
}
