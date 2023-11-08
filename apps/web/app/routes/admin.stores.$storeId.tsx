import { json, type LoaderFunction, type MetaFunction } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";
import invariant from "tiny-invariant";
import { Breadcrumbs } from "~/components/breadcrumbs";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const loader: LoaderFunction = async ({ request, context, params }) => {
  invariant(params.storeId);

  const store = await context.trpc.storeById.query(
    parseInt(params.storeId as string, 10),
  );

  return json({ store });
};

export const meta: MetaFunction = ({ data }) => {
  return [
    {
      title: data.store.name,
    },
  ];
};

export default function AdminStoreDetails() {
  const { store } = useLoaderData<typeof loader>();

  return (
    <div>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            to: "/admin",
          },
          {
            name: "Stores",
            to: "/admin/stores",
          },
          {
            name: store.name,
            to: `/admin/stores/${store.id}`,
            current: true,
          },
        ]}
      />
      <Outlet context={{ store }} />
    </div>
  );
}
