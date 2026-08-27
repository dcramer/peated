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

  const createBrand = useMutation(orpc.brands.create.mutationOptions());
  const createDistillery = useMutation(
    orpc.distilleries.create.mutationOptions(),
  );
  const createBottler = useMutation(orpc.bottlers.create.mutationOptions());
  const createBlender = useMutation(orpc.blenders.create.mutationOptions());
  const createCompany = useMutation(orpc.companies.create.mutationOptions());

  return (
    <EntityForm
      onSubmit={async (data) => {
        const { kind, ...input } = data;
        const mutation = {
          brand: createBrand,
          distillery: createDistillery,
          bottler: createBottler,
          blender: createBlender,
          company: createCompany,
        }[kind];
        const newEntity = await mutation.mutateAsync(input);
        router.push(getEntityUrl(newEntity));
      }}
      initialData={{ kind }}
      title="Add Entity"
    />
  );
}
