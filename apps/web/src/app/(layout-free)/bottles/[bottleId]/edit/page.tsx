"use client";
import { use } from "react";

import BottleForm from "@peated/web/components/bottleForm";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import { ModRequired } from "@peated/web/hooks/useAuthRequired";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { formQueryOptions } from "@peated/web/lib/orpc/query";
import { getBottleUrl } from "@peated/web/lib/urls";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { buildBottlePatch } from "./buildBottlePatch";

export default function Page(props: { params: Promise<{ bottleId: string }> }) {
  const params = use(props.params);

  const { bottleId } = params;

  return (
    <ModRequired>
      <BottleEditForm bottleId={bottleId} />
    </ModRequired>
  );
}

function BottleEditForm({ bottleId }: { bottleId: string }) {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { data: context } = useSuspenseQuery(
    formQueryOptions(
      orpc.bottles.editContext.queryOptions({
        input: { bottle: Number(bottleId) },
      }),
    ),
  );
  const router = useRouter();
  const bottleUpdateMutation = useMutation(
    orpc.bottles.update.mutationOptions(),
  );
  const bottleImageUpdateMutation = useMutation(
    orpc.bottles.imageUpdate.mutationOptions(),
  );
  const { flash } = useFlashMessages();

  return (
    <BottleForm
      onSubmit={async (value, meta) => {
        const { image } = value;
        const updatedBottle = await bottleUpdateMutation.mutateAsync({
          bottle: context.bottleId,
          ...buildBottlePatch(value, meta),
        });

        const imageMetadataChanged =
          meta.dirtyFields.has("imageSourceUrl") ||
          meta.dirtyFields.has("imageLicense");
        if (image || (image !== null && imageMetadataChanged)) {
          try {
            await bottleImageUpdateMutation.mutateAsync({
              bottle: context.bottleId,
              file: image || undefined,
              sourceUrl: value.imageSourceUrl,
              license: value.imageLicense,
            });
          } catch (err) {
            logError(err, {
              context: "bottle_edit_image_upload",
              extra: { bottleId: context.bottleId },
            });
            flash(
              "We couldn't upload the image, but the bottle was saved. Try the image again.",
              "error",
            );
          }
        }

        await queryClient.invalidateQueries({
          queryKey: orpc.bottles.details.key({
            input: { bottle: context.bottleId },
          }),
          refetchType: "all",
        });
        router.push(getBottleUrl(updatedBottle));
      }}
      initialData={{
        ...context.shared,
        ...context.exact,
        statedAge: context.exact.noAgeStatement
          ? null
          : (context.exact.statedAge ?? context.shared.statedAge),
      }}
      title="Edit Bottle"
      saveLabel="Save Changes"
    />
  );
}
