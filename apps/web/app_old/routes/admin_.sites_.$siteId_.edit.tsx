import { type ExternalSiteType } from "@peated/server/types";
import { type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useNavigate } from "react-router-dom";
import type { SitemapFunction } from "remix-sitemap";
import invariant from "tiny-invariant";
import SiteForm from "../components/admin/siteForm";
import { redirectToAuth } from "../lib/auth";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";
import { trpc } from "../lib/trpc";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ request, params: { siteId }, context: { user, queryUtils } }) => {
    invariant(siteId);

    if (!user?.admin) return redirectToAuth({ request });

    const site = await queryUtils.externalSiteByType.ensureData(
      siteId as ExternalSiteType,
    );

    return { site };
  },
);

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const meta: MetaFunction = () => {
  return [
    {
      title: "Edit Site",
    },
  ];
};

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
