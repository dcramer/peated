import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";
import invariant from "tiny-invariant";
import { Breadcrumbs } from "~/components/breadcrumbs";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export async function loader({
  params: { storeId },
  context: { trpc },
}: LoaderFunctionArgs) {
  invariant(storeId);

  const store = await trpc.storeById.query(Number(storeId));

  return json({ store });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [];

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
