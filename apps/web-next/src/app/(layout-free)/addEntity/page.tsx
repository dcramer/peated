"use client";

import EntityForm from "@peated/web/components/entityForm";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc";
import { useRouter } from "next/navigation";

export default function AddEntity() {
  useAuthRequired();

  const router = useRouter();

  const entityCreateMutation = trpc.entityCreate.useMutation();

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
