import { EntityTypeEnum } from "@peated/server/schemas";
import type { EntityType } from "@peated/server/types";
import EntityForm from "@peated/web/components/entityForm";
import { useVerifiedRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  type: z
    .union([EntityTypeEnum, z.array(EntityTypeEnum)])
    .default([])
    .transform((val) => (Array.isArray(val) ? val : [val])),
});

export const Route = createFileRoute("/addEntity")({
  component: AddEntity,
  validateSearch: searchSchema,
});

function AddEntity() {
  useVerifiedRequired();

  const navigate = useNavigate();
  const orpc = useORPC();
  const { type } = Route.useSearch();

  const entityCreateMutation = useMutation(
    orpc.entities.create.mutationOptions()
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
