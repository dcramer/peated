"use client";

import useAuthRequired from "@peated/web-next/hooks/useAuthRequired";
import EntityForm from "@peated/web/components/entityForm";
import { trpcClient } from "@peated/web/lib/trpc";
import { useRouter } from "next/navigation";

export default function AddEntity() {
  useAuthRequired();

  const router = useRouter();

  const entityCreateMutation = trpcClient.entityCreate.useMutation();

  return (
    <EntityForm
      onSubmit={async (data) => {
        const newEntity = await entityCreateMutation.mutateAsync(data);
        router.push(`/entities/${newEntity.id}`);
      }}
      title="Add Entity"
    />
  );
}
