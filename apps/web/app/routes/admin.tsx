import Layout from "@peated/web/components/layout";
import type { MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

import type { SitemapFunction } from "remix-sitemap";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const meta: MetaFunction = () => {
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
