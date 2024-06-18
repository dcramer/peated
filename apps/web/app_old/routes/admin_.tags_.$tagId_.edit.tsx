import { type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useNavigate } from "react-router-dom";
import type { SitemapFunction } from "remix-sitemap";
import invariant from "tiny-invariant";
import TagForm from "../components/admin/tagForm";
import { redirectToAuth } from "../lib/auth";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";
import { trpc } from "../lib/trpc";

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ request, params: { tagId }, context: { user, queryUtils } }) => {
    invariant(tagId);

    if (!user?.admin) return redirectToAuth({ request });

    const tag = await queryUtils.tagByName.ensureData(tagId);

    return { tag };
  },
);

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const meta: MetaFunction = () => {
  return [
    {
      title: "Edit Tag",
    },
  ];
};

export default function AdminTagsEdit() {
  const { tag } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const tagUpdateMutation = trpc.tagUpdate.useMutation();

  return (
    <TagForm
      onSubmit={async (data) => {
        const newTag = await tagUpdateMutation.mutateAsync({
          ...data,
          name: tag.name,
        });
        navigate(`/admin/tags/${newTag.name}`);
      }}
      edit
      initialData={tag}
    />
  );
}
