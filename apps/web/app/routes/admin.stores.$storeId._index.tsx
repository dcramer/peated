import { json, type LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";
import invariant from "tiny-invariant";
import StorePriceTable from "~/components/admin/storePriceTable";
import EmptyActivity from "~/components/emptyActivity";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const loader: LoaderFunction = async ({ request, context, params }) => {
  invariant(params.storeId);

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || 1);
  const priceList = await context.trpc.storePriceList.query({
    store: Number(params.storeId),
    page,
  });

  return json({ priceList });
};

export default function AdminStoreDetails() {
  const { priceList } = useLoaderData<typeof loader>();

  return (
    <div>
      {priceList.results.length > 0 ? (
        <StorePriceTable priceList={priceList.results} rel={priceList.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </div>
  );
}
