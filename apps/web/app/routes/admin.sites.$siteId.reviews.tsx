import { type ExternalSiteType } from "@peated/server/types";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { useLoaderData } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";
import invariant from "tiny-invariant";
import ReviewTable from "../components/admin/reviewTable";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ request, context: { queryUtils }, params: { siteId } }) => {
    invariant(siteId);

    const { searchParams } = new URL(request.url);
    const numericFields = new Set(["cursor", "limit"]);
    const reviewList = await queryUtils.reviewList.ensureData({
      site: siteId as ExternalSiteType,
      ...Object.fromEntries(
        [...searchParams.entries()].map(([k, v]) =>
          numericFields.has(k) ? [k, Number(v)] : [k, v === "" ? null : v],
        ),
      ),
    });

    return { reviewList };
  },
);

export default function AdminSiteDetails() {
  const { reviewList } = useLoaderData<typeof loader>();

  return (
    <div>
      {reviewList.results.length > 0 ? (
        <ReviewTable reviewList={reviewList.results} rel={reviewList.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </div>
  );
}
