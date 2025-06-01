"use client";

import type { EntityType } from "@peated/server/types";
import EntityForm from "@peated/web/components/entityForm";
import { useVerifiedRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

export default function AddEntity() {
  useVerifiedRequired();

  const router = useRouter();
  const orpc = useORPC();

  const searchParams = useSearchParams();
  const type = searchParams.getAll("type") as EntityType[];

  const entityCreateMutation = useMutation(
    orpc.entities.create.mutationOptions()
  );

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
