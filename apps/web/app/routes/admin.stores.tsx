import { type MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const meta: MetaFunction = () => {
  return [
    {
      title: "Stores",
    },
  ];
};

export default function AdminStoresLayout() {
  return <Outlet />;
}
