import { type MetaFunction } from "@remix-run/node";
import { useNavigate } from "react-router-dom";
import type { SitemapFunction } from "remix-sitemap";
import TagForm from "../components/admin/tagForm";
import { redirectToAuth } from "../lib/auth";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";
import { trpc } from "../lib/trpc";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ request, context: { user } }) => {
    if (!user?.admin) return redirectToAuth({ request });
    return null;
  },
);

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const meta: MetaFunction = () => {
  return [
    {
      title: "Add Tag",
    },
  ];
};

export default function AdminSiteesAdd() {
  const navigate = useNavigate();
  const tagCreateMutation = trpc.tagCreate.useMutation();

  return (
    <TagForm
      onSubmit={async (data) => {
        const tag = await tagCreateMutation.mutateAsync({
          ...data,
        });
        navigate(`/admin/tags/${tag.name}`);
      }}
    />
  );
}
