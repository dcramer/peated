import { redirectToAuth } from "@peated/web/lib/auth";
import { trpc } from "@peated/web/lib/trpc";
import { type LoaderFunction, type MetaFunction } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";
import type { SitemapFunction } from "remix-sitemap";

import EntityForm from "../components/entityForm";
export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export const loader: LoaderFunction = ({ request, context }) => {
  if (!context.user) return redirectToAuth({ request });

  return null;
};

export const meta: MetaFunction = () => {
  return [
    {
      title: "Add Entity",
    },
  ];
};

export default function AddEntity() {
  const navigate = useNavigate();

  const entityCreateMutation = trpc.entityCreate.useMutation();

  return (
    <EntityForm
      onSubmit={async (data) => {
        const newEntity = await entityCreateMutation.mutateAsync(data);
        navigate(`/entities/${newEntity.id}`, {
          replace: true,
        });
      }}
      title="Add Entity"
    />
  );
}
