import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";
import BadgeTable from "~/components/admin/badgeTable";
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
  const badgeList = await trpc.badgeList.query({
    page,
    sort: "name",
  });

  return json({ badgeList });
}

export default function AdminBadges() {
  const { badgeList } = useLoaderData<typeof loader>();

  return (
    <div>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            to: "/admin",
          },
          {
            name: "Badges",
            to: "/admin/badges",
            current: true,
          },
        ]}
      />
      <div className="flex items-center justify-end">
        <Button color="primary" to="/admin/badges/add">
          Add Badge
        </Button>
      </div>
      {badgeList.results.length > 0 ? (
        <BadgeTable badgeList={badgeList.results} rel={badgeList.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </div>
  );
}
