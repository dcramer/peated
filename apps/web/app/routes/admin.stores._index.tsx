import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";
import StoreTable from "~/components/admin/storeTable";
import { Breadcrumbs } from "~/components/breadcrumbs";
import Button from "~/components/button";
import EmptyActivity from "~/components/emptyActivity";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export async function loader({
  request,
  context: { trpc },
}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || 1);
  const storeList = await trpc.storeList.query({
    page,
    sort: "name",
  });

  return json({ storeList });
}

export default function AdminStores() {
  const { storeList } = useLoaderData<typeof loader>();

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
            current: true,
          },
        ]}
      />
      <div className="flex items-center justify-end">
        <Button color="primary" to="/admin/stores/add">
          Add Store
        </Button>
      </div>
      {storeList.results.length > 0 ? (
        <StoreTable storeList={storeList.results} rel={storeList.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </div>
  );
}
