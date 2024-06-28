"use client";

import { type EntityType } from "@peated/server/types";
import EntityForm from "@peated/web/components/entityForm";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AddEntity() {
  useAuthRequired();

  const router = useRouter();

  const searchParams = useSearchParams();
  const type = searchParams.getAll("type") as EntityType[];

  const entityCreateMutation = trpc.entityCreate.useMutation();

  return (
    <EntityForm
      onSubmit={async (data) => {
        const newEntity = await entityCreateMutation.mutateAsync(data);
        router.push(`/entities/${newEntity.id}`);
      }}
      initialData={{ type }}
      title="Add Entity"
    />
  );
}
