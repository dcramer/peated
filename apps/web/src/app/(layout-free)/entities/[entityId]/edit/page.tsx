"use client";

import EntityForm from "@peated/web/components/entityForm";
import { ModRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  return (
    <ModRequired>
      <EntityEditForm entityId={entityId} />
    </ModRequired>
  );
}

function EntityEditForm({ entityId }: { entityId: string }) {
  const orpc = useORPC();
  const { data: entity } = useSuspenseQuery(
    orpc.entities.details.queryOptions({ input: { entity: Number(entityId) } }),
  );
  const router = useRouter();

  const entityUpdateMutation = useMutation(
    orpc.entities.update.mutationOptions(),
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
              router.push(`/entities/${entity.id}`);
            },
          },
        );
      }}
      initialData={entity}
      title="Edit Entity"
    />
  );
}
