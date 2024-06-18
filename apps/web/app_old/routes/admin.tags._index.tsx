import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { useLoaderData } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";
import TagTable from "../components/admin/tagTable";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ request, context: { queryUtils } }) => {
    const { searchParams } = new URL(request.url);
    const tagList = await queryUtils.tagList.ensureData({
      ...Object.fromEntries(searchParams.entries()),
    });

    return { tagList };
  },
);

export default function AdminTags() {
  const { tagList } = useLoaderData<typeof loader>();

  return (
    <div>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            to: "/admin",
          },
          {
            name: "Tags",
            to: "/admin/tags",
            current: true,
          },
        ]}
      />
      <div className="flex items-center justify-end">
        <Button color="primary" to="/admin/tags/add">
          Add Tag
        </Button>
      </div>
      {tagList.results.length > 0 ? (
        <TagTable tagList={tagList.results} rel={tagList.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </div>
  );
}
