import { type ExternalSiteType } from "@peated/server/src/types";
import { type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { json, type LoaderFunctionArgs } from "@remix-run/server-runtime";
import { useNavigate } from "react-router-dom";
import type { SitemapFunction } from "remix-sitemap";
import invariant from "tiny-invariant";
import SiteForm from "../components/admin/siteForm";
import { trpc } from "../lib/trpc";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const meta: MetaFunction = () => {
  return [
    {
      title: "Add Store",
    },
  ];
};

export async function loader({
  params: { siteId },
  context: { trpc },
}: LoaderFunctionArgs) {
  invariant(siteId);

  const site = await trpc.externalSiteByType.query(siteId as ExternalSiteType);

  return json({ site });
}

export default function AdminSitesEdit() {
  const { site } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const siteUpdateMutation = trpc.externalSiteUpdate.useMutation();

  return (
    <SiteForm
      onSubmit={async (data) => {
        const newSite = await siteUpdateMutation.mutateAsync({
          site: site.type,
          ...data,
        });
        navigate(`/admin/sites/${newSite.type}`);
      }}
      initialData={site}
    />
  );
}
