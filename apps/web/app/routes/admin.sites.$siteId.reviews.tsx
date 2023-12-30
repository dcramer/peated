import { type ExternalSiteType } from "@peated/server/types";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { json, type LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";
import invariant from "tiny-invariant";
import ReviewTable from "../components/admin/reviewTable";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const loader: LoaderFunction = async ({ request, context, params }) => {
  invariant(params.siteId);

  const { searchParams } = new URL(request.url);
  const reviewList = await context.trpc.reviewList.query({
    site: params.siteId as ExternalSiteType,
    ...Object.fromEntries(searchParams.entries()),
  });

  return json({ reviewList });
};

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
