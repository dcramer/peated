import { type ExternalSiteSchema } from "@peated/server/schemas";
import { toTitleCase } from "@peated/server/src/lib/strings";
import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import { type MetaFunction } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import type { SitemapFunction } from "remix-sitemap";
import invariant from "tiny-invariant";
import { type z } from "zod";
import Button from "../components/button";
import QueryBoundary from "../components/queryBoundary";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ params: { tagId }, context: { queryUtils } }) => {
    invariant(tagId);

    const tag = await queryUtils.tagByName.ensureData(tagId);

    return { tag };
  },
);

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) return [];

  return [
    {
      title: toTitleCase(data.tag.name),
    },
  ];
};

type UpdateSiteFn = (data: z.infer<typeof ExternalSiteSchema>) => void;

export default function AdminSiteDetails() {
  const { tag: initialSite } = useLoaderData<typeof loader>();
  const [tag, setTag] = useState(initialSite);

  return (
    <div className="w-full p-3 lg:py-0">
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            to: "/admin",
          },
          {
            name: "Tags",
            to: "/admin/tags",
          },
          {
            name: toTitleCase(tag.name),
            to: `/admin/tags/${tag.name}`,
            current: true,
          },
        ]}
      />

      <div className="my-8 flex min-w-full flex-wrap gap-y-4 sm:flex-nowrap">
        <div className="flex w-full flex-col justify-center gap-y-4 px-4 sm:w-auto sm:flex-auto sm:gap-y-2">
          <h3 className="self-center text-4xl font-semibold text-white sm:self-start">
            {toTitleCase(tag.name)}
          </h3>
          <div className="text-light flex flex-col items-center self-center sm:flex-row sm:self-start lg:mb-8">
            {toTitleCase(tag.tagCategory)}
          </div>
        </div>
        <div className="flex w-full flex-col items-center justify-center sm:w-auto sm:items-end">
          <div className="flex gap-x-2">
            <Button to={`/admin/tags/${tag.name}/edit`}>Edit Tag</Button>
          </div>
        </div>
      </div>

      <QueryBoundary>
        <Outlet context={{ tag }} />
      </QueryBoundary>
    </div>
  );
}
