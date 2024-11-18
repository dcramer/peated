"use client";
import { use } from "react";

import EntityForm from "@peated/web/components/entityForm";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc/client";
import { useRouter } from "next/navigation";

export default function Page(props: { params: Promise<{ entityId: string }> }) {
  const params = use(props.params);

  const { entityId } = params;

  useModRequired();

  const [entity] = trpc.entityById.useSuspenseQuery(Number(entityId));
  const router = useRouter();
  const entityUpdateMutation = trpc.entityUpdate.useMutation();

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
