import { type ExternalSiteType } from "@peated/server/types";
import StorePriceTable from "@peated/web/components/admin/storePriceTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { useLoaderData } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";
import invariant from "tiny-invariant";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ request, context: { queryUtils }, params: { siteId } }) => {
    invariant(siteId);

    const { searchParams } = new URL(request.url);
    const priceList = await queryUtils.priceList.ensureData({
      site: siteId as ExternalSiteType,
      ...Object.fromEntries(searchParams.entries()),
    });

    return { priceList };
  },
);

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
