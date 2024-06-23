"use client";

import EntityForm from "@peated/web/components/entityForm";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc";
import { useRouter } from "next/navigation";

export default function Page({
  params: { entityId },
}: {
  params: { entityId: string };
}) {
  useModRequired();

  const [entity] = trpc.entityById.useSuspenseQuery(Number(entityId));
  const router = useRouter();

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
            onSuccess: () => router.push(`/entities/${entity.id}`),
          },
        );
      }}
      initialData={entity}
      title="Edit Entity"
    />
  );
}
