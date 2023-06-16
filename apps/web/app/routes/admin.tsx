import type { V2_MetaFunction } from "@remix-run/node";
import { NavLink, Outlet } from "@remix-run/react";
import Layout from "~/components/layout";

import classNames from "~/lib/classNames";

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "Admin",
      current: true,
    },
  ];
};

export default function AdminLayout() {
  return (
    <Layout>
      <div className="flex">
        <nav className="w-56">
          <ul role="list" className="mr-6 flex flex-1 flex-col gap-y-4">
            <li>
              <NavLink
                to="/admin/stores"
                className={({ isActive, isPending }) =>
                  classNames(
                    isActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white",
                    "flex gap-x-3 rounded-md p-2 text-sm font-semibold",
                  )
                }
              >
                Stores
              </NavLink>
            </li>
          </ul>
        </nav>
        <div className="my-2 flex-1">
          <Outlet />
        </div>
      </div>
    </Layout>
  );
}
