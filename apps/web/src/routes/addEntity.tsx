import { type EntityType } from "@peated/server/types";
import EntityForm from "@peated/web/components/entityForm";
import { useVerifiedRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/addEntity")({
  component: AddEntity,
  validateSearch: (search: Record<string, unknown>) => ({
    type: (Array.isArray(search.type)
      ? search.type
      : search.type
        ? [search.type]
        : []) as EntityType[],
  }),
});

function AddEntity() {
  useVerifiedRequired();

  const navigate = useNavigate();
  const orpc = useORPC();
  const { type } = Route.useSearch();

  const entityCreateMutation = useMutation(
    orpc.entities.create.mutationOptions(),
  );

  return (
    <EntityForm
      onSubmit={async (data) => {
        const newEntity = await entityCreateMutation.mutateAsync(data);
        navigate({ to: `/entities/${newEntity.id}` });
      }}
      initialData={{ type }}
      title="Add Entity"
    />
  );
}
