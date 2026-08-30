"use client";
import { use } from "react";

import { toTitleCase } from "@peated/server/lib/strings";
import EntityForm from "@peated/web/components/entityForm";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import { ModRequired } from "@peated/web/hooks/useAuthRequired";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { formQueryOptions } from "@peated/web/lib/orpc/query";
import { saveEntityImages } from "@peated/web/lib/saveEntityImages";
import { getEntityUrl } from "@peated/web/lib/urls";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page(props: { params: Promise<{ entityId: string }> }) {
  const params = use(props.params);

  const { entityId } = params;

  return (
    <ModRequired>
      <EntityEditForm entityId={entityId} />
    </ModRequired>
  );
}

function EntityEditForm({ entityId }: { entityId: string }) {
  const orpc = useORPC();
  const { data: entity } = useSuspenseQuery(
    formQueryOptions(
      orpc.entities.details.queryOptions({
        input: { entity: Number(entityId) },
      }),
    ),
  );
  const router = useRouter();
  const queryClient = useQueryClient();

  const entityUpdateMutation = useMutation(
    orpc.entities.update.mutationOptions(),
  );
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
        const updatedEntity = await entityUpdateMutation.mutateAsync({
          entity: entity.id,
          ...data,
        });
        try {
          await saveEntityImages({
            entityId: entity.id,
            initialImages: entity.images,
            images,
            create: (input) => createImage.mutateAsync(input),
            update: (input) => updateImage.mutateAsync(input),
            remove: (input) => deleteImage.mutateAsync(input),
          });
        } catch (error) {
          logError(error, {
            context: "entity_edit_image_save",
            extra: { entityId: entity.id },
          });
          flash(
            "We saved the details, but couldn't save every image. Try again from Edit.",
            "error",
          );
        }
        await queryClient.invalidateQueries({
          queryKey: orpc.entities.details.key({
            input: { entity: entity.id },
            type: "query",
          }),
          refetchType: "all",
        });
        router.push(getEntityUrl(updatedEntity));
      }}
      initialData={entity}
      title={`Edit ${toTitleCase(entity.kind)}`}
    />
  );
}
