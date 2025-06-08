import EntityForm from "@peated/web/components/entityForm";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/entities_/$entityId/edit")({
  component: Page,
});

function Page() {
  useModRequired();

  const { entityId } = Route.useParams();
  const orpc = useORPC();
  const { data: entity } = useSuspenseQuery(
    orpc.entities.details.queryOptions({ input: { entity: Number(entityId) } })
  );
  const navigate = useNavigate();

  const entityUpdateMutation = useMutation(
    orpc.entities.update.mutationOptions()
  );

  return (
    <EntityForm
      onSubmit={async (data) => {
        await entityUpdateMutation.mutateAsync(
          {
            entity: entity.id,
            ...data,
          },
          {
            onSuccess: () => {
              navigate({ to: `/entities/${entity.id}` });
            },
          }
        );
      }}
      initialData={entity}
      title="Edit Entity"
    />
  );
}
