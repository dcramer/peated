import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
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
  const userList = await trpc.userList.query({
    sort: "-created",
    ...Object.fromEntries(searchParams.entries()),
  });

  return json({ userList });
}

export default function AdminUsers() {
  const { userList } = useLoaderData<typeof loader>();

  return (
    <div>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            to: "/admin",
          },
          {
            name: "Users",
            to: "/admin/users",
            current: true,
          },
        ]}
      />
      <Table
        items={userList.results}
        rel={userList.rel}
        defaultSort="-created"
        url={(item) => `/users/${item.username}`}
        columns={[
          { name: "username", sort: "name", sortDefaultOrder: "asc" },
          {
            name: "createdAt",
            title: "Created",
            sort: "created",
            value: (v) => !!v.createdAt && <TimeSince date={v.createdAt} />,
          },
        ]}
      />
    </div>
  );
}
