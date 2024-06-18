import Spinner from "@peated/web/components/spinner";
import { trpc } from "@peated/web/lib/trpc";
import { type MetaFunction } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import invariant from "tiny-invariant";
import EntityForm from "../components/entityForm";
import { makeIsomorphicLoader } from "../lib/isomorphicLoader";

export const meta: MetaFunction = () => {
  return [
    {
      title: "Edit Entity",
    },
  ];
};

export const { loader, clientLoader } = makeIsomorphicLoader(
  async ({ params: { entityId }, context: { queryUtils } }) => {
    invariant(entityId);

    const entity = await queryUtils.entityById.ensureData(Number(entityId));

    return { entity };
  },
);

export default function EditEntity() {
  const { entity } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  if (!entity) return <Spinner />;

  const trpcUtils = trpc.useUtils();

  const entityUpdateMutation = trpc.entityUpdate.useMutation({
    onSuccess: (data) => {
      if (!data) return;
      const previous = trpcUtils.entityById.getData(data.id);
      if (previous) {
        trpcUtils.entityById.setData(data.id, {
          ...previous,
          ...data,
        });
      }
    },
  });

  return (
    <EntityForm
      onSubmit={async (data) => {
        await entityUpdateMutation.mutateAsync(
          {
            entity: entity.id,
            ...data,
          },
          {
            onSuccess: () => navigate(`/entities/${entity.id}`),
          },
        );
      }}
      initialData={entity}
      title="Edit Entity"
    />
  );
}
