import BadgeTable from "@peated/web/components/admin/badgeTable";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { useLoaderData } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ request, context: { queryUtils } }) => {
    const { searchParams } = new URL(request.url);
    const badgeList = await queryUtils.badgeList.ensureData({
      sort: "name",
      ...Object.fromEntries(searchParams.entries()),
    });

    return { badgeList };
  },
);

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
