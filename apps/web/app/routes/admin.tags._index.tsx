import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";
import TagTable from "../components/admin/tagTable";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export async function loader({
  request,
  context: { trpc },
}: LoaderFunctionArgs) {
  const { searchParams } = new URL(request.url);
  const tagList = await trpc.tagList.query({
    ...Object.fromEntries(searchParams.entries()),
  });

  return json({ tagList });
}

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
