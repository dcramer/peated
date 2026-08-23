"use client";

import { EntityTypeEnum } from "@peated/server/schemas";
import EntityForm from "@peated/web/components/entityForm";
import { VerifiedRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

export default function AddEntity() {
  return (
    <VerifiedRequired>
      <AddEntityForm />
    </VerifiedRequired>
  );
}

function AddEntityForm() {
  const router = useRouter();
  const orpc = useORPC();

  const searchParams = useSearchParams();
  const type = searchParams.getAll("type").flatMap((value) => {
    const parsed = EntityTypeEnum.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });

  const entityCreateMutation = useMutation(
    orpc.entities.create.mutationOptions(),
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
