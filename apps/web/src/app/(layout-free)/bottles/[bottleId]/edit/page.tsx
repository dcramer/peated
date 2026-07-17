"use client";
import { use } from "react";

import BottleForm from "@peated/web/components/bottleForm";
import { useFlashMessages } from "@peated/web/components/flash";
import { ModRequired } from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { buildConcreteBottleUpdateInput } from "./buildConcreteBottleUpdateInput";

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
  const { data: context } = useSuspenseQuery(
    orpc.bottles.editContext.queryOptions({
      input: { bottle: Number(bottleId) },
    }),
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
        await bottleUpdateMutation.mutateAsync({
          bottle: context.bottleId,
          ...buildConcreteBottleUpdateInput(value, meta),
        });

        if (image) {
          try {
            await bottleImageUpdateMutation.mutateAsync({
              bottle: context.bottleId,
              file: await toBlob(image),
            });
          } catch (err) {
            logError(err, {
              context: "bottle_edit_image_upload",
              extra: { bottleId: context.bottleId },
            });
            flash(
              "There was an error uploading your image, but the bottle was saved.",
              "error",
            );
          }
        }

        router.push(`/bottles/${bottleId}`);
      }}
      initialData={{
        ...context.shared,
        ...context.exact,
        statedAge: context.shared.statedAge,
      }}
      showBottleReleaseDetails
      sharedIdentityBottleCount={context.totalBottles}
      title="Edit Bottle"
    />
  );
}
