import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";
import Table from "../components/table";
import TimeSince from "../components/timeSince";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export async function loader({
  request,
  context: { trpc },
}: LoaderFunctionArgs) {
  const { searchParams } = new URL(request.url);
  const siteList = await trpc.externalSiteList.query({
    sort: "name",
    ...Object.fromEntries(searchParams.entries()),
  });

  return json({ siteList });
}

export default function AdminSites() {
  const { siteList } = useLoaderData<typeof loader>();

  return (
    <div>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            to: "/admin",
          },
          {
            name: "Sites",
            to: "/admin/sites",
            current: true,
          },
        ]}
      />
      <div className="flex items-center justify-end">
        <Button color="primary" to="/admin/sites/add">
          Add Site
        </Button>
      </div>

      {siteList.results.length > 0 ? (
        <Table
          items={siteList.results}
          rel={siteList.rel}
          defaultSort="-created"
          primaryKey={(item) => item.type}
          url={(item) => `/admin/sites/${item.type}`}
          columns={[
            { name: "name", sort: "name", sortDefaultOrder: "asc" },
            {
              name: "lastRunAt",
              title: "Last Run",
              value: (v) =>
                v.lastRunAt ? <TimeSince date={v.lastRunAt} /> : <>&mdash;</>,
            },
          ]}
        />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </div>
  );
}
