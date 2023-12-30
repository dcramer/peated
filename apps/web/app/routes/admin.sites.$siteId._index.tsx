import StorePriceTable from "@peated/web/components/admin/storePriceTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { json, type LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";
import invariant from "tiny-invariant";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const loader: LoaderFunction = async ({ request, context, params }) => {
  invariant(params.siteId);

  const { searchParams } = new URL(request.url);
  const priceList = await context.trpc.storePriceList.query({
    site: params.siteId as any,
    ...Object.fromEntries(searchParams.entries()),
  });

  return json({ priceList });
};

export default function AdminSiteDetails() {
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
