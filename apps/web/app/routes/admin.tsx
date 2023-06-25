import type { V2_MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import Layout from "~/components/layout";

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
      <Outlet />
    </Layout>
  );
}
