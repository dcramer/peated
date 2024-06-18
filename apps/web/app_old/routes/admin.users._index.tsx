import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import { useLoaderData } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";
import Table from "../components/table";
import TimeSince from "../components/timeSince";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ request, context: { queryUtils } }) => {
    const { searchParams } = new URL(request.url);
    const numericFields = new Set(["cursor", "limit"]);

    const userList = await queryUtils.userList.ensureData({
      sort: "-created",
      ...Object.fromEntries(
        [...searchParams.entries()].map(([k, v]) =>
          numericFields.has(k) ? [k, Number(v)] : [k, v === "" ? null : v],
        ),
      ),
    });

    return { userList };
  },
);

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
