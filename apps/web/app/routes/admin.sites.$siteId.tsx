import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";
import invariant from "tiny-invariant";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export async function loader({
  params: { siteId },
  context: { trpc },
}: LoaderFunctionArgs) {
  invariant(siteId);

  const site = await trpc.externalSiteByType.query(siteId as any);

  return json({ site });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [];

  return [
    {
      title: data.site.name,
    },
  ];
};

export default function AdminSiteDetails() {
  const { site } = useLoaderData<typeof loader>();

  return (
    <div>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            to: "/admin",
          },
          {
            name: "External Sites",
            to: "/admin/sites",
          },
          {
            name: site.name,
            to: `/admin/sites/${site.id}`,
            current: true,
          },
        ]}
      />
      <Outlet context={{ site }} />
    </div>
  );
}
