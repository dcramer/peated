"use client";
import { use } from "react";

import BottleForm from "@peated/web/components/bottleForm";
import { useFlashMessages } from "@peated/web/components/flash";
import { ModRequired } from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { formQueryOptions } from "@peated/web/lib/orpc/query";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { buildBottleUpdateInput } from "./buildBottleUpdateInput";

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
        await bottleUpdateMutation.mutateAsync({
          bottle: context.bottleId,
          ...buildBottleUpdateInput(value, meta, {
            statedAgeScope:
              context.exact.statedAge === null ? "shared" : "exact",
          }),
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
        statedAge: context.exact.statedAge ?? context.shared.statedAge,
      }}
      title="Edit Bottle"
      saveLabel="Save Changes"
    />
  );
}
