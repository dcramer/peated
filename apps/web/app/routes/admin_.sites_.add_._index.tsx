import { type MetaFunction } from "@remix-run/node";
import { useNavigate } from "react-router-dom";
import type { SitemapFunction } from "remix-sitemap";
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

export default function AdminSiteesAdd() {
  const navigate = useNavigate();
  const siteCreateMutation = trpc.externalSiteCreate.useMutation();

  return (
    <SiteForm
      onSubmit={async (data) => {
        const site = await siteCreateMutation.mutateAsync({
          ...data,
        });
        navigate(`/admin/sites/${site.type}`);
      }}
    />
  );
}
