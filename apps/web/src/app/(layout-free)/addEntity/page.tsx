"use client";

import { toTitleCase } from "@peated/server/lib/strings";
import { EntityKindEnum } from "@peated/server/schemas";
import EntityForm from "@peated/web/components/entityForm";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import { VerifiedRequired } from "@peated/web/hooks/useAuthRequired";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { saveEntityImages } from "@peated/web/lib/saveEntityImages";
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
  const createImage = useMutation(
    orpc.entities.images.create.mutationOptions(),
  );
  const updateImage = useMutation(
    orpc.entities.images.update.mutationOptions(),
  );
  const deleteImage = useMutation(
    orpc.entities.images.delete.mutationOptions(),
  );
  const { flash } = useFlashMessages();

  return (
    <EntityForm
      onSubmit={async (data, images) => {
        const newEntity = await createEntity.mutateAsync(data);
        try {
          await saveEntityImages({
            entityId: newEntity.id,
            initialImages: [],
            images,
            create: (input) => createImage.mutateAsync(input),
            update: (input) => updateImage.mutateAsync(input),
            remove: (input) => deleteImage.mutateAsync(input),
          });
        } catch (error) {
          logError(error, {
            context: "entity_create_image_save",
            extra: { entityId: newEntity.id },
          });
          flash(
            "We saved the record, but couldn't upload every image. Add them from Edit.",
            "error",
          );
        }
        router.push(getEntityUrl(newEntity));
      }}
      initialData={{ kind }}
      title={`Add ${toTitleCase(kind)}`}
    />
  );
}
