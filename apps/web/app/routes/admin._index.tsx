import { Link } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";
import { Breadcrumbs } from "~/components/breadcrumbs";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export default function Admin() {
  return (
    <>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            to: "/admin",
          },
        ]}
      />
      <div className="prose">
        <ul>
          <li>
            <Link to="/admin/stores">Stores & Pricing Aggregators</Link>
          </li>
          <li>
            <Link to="/admin/badges">Badges</Link>
          </li>
        </ul>
      </div>
    </>
  );
}
