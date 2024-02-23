import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import { Link } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";
import SimpleHeader from "../components/simpleHeader";
import { trpc } from "../lib/trpc";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

function FaktoryStats() {
  const { data } = trpc.faktoryInfo.useQuery();

  if (!data) return null;

  console.log(data);

  return (
    <>
      <SimpleHeader>Faktory</SimpleHeader>
      <div className="my-6 grid grid-cols-5 items-center gap-3 text-center">
        {Object.entries(data.faktory.tasks).map(([name, stats]) => {
          return (
            <div className="mr-4 pr-3 text-center" key={name}>
              <span className="block text-xl font-bold uppercase tracking-wide text-white">
                {stats.size.toLocaleString()}
              </span>
              <span className="text-light text-sm">{name}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

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
            <Link to="/admin/sites">External Site Aggregators</Link>
          </li>
          <li>
            <Link to="/admin/badges">Badges</Link>
          </li>
        </ul>
      </div>

      <div>
        <FaktoryStats />
      </div>
    </>
  );
}
