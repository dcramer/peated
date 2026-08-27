"use client";

import { EntityKindEnum } from "@peated/server/schemas";
import EntityForm from "@peated/web/components/entityForm";
import { VerifiedRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { getEntityUrl } from "@peated/web/lib/urls";
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
  const parsedKind = EntityKindEnum.safeParse(searchParams.get("kind"));
  const kind = parsedKind.success ? parsedKind.data : "brand";

  const createEntity = useMutation(orpc.entities.create.mutationOptions());

  return (
    <EntityForm
      onSubmit={async (data) => {
        const newEntity = await createEntity.mutateAsync(data);
        router.push(getEntityUrl(newEntity));
      }}
      initialData={{ kind }}
      title="Add Entity"
    />
  );
}
