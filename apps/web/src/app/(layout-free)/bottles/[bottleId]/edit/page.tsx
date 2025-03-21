"use client";

import BottleForm from "@peated/web/components/bottleForm";
import { useFlashMessages } from "@peated/web/components/flash";
import useApi from "@peated/web/hooks/useApi";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { trpc } from "@peated/web/lib/trpc/client";
import { useRouter } from "next/navigation";

export default function Page({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  useModRequired();

  const [bottle] = trpc.bottleById.useSuspenseQuery(Number(bottleId));
  const router = useRouter();
  const bottleUpdateMutation = trpc.bottleUpdate.useMutation();
  const api = useApi();
  const { flash } = useFlashMessages();

  return (
    <BottleForm
      onSubmit={async ({ image, ...data }) => {
        await bottleUpdateMutation.mutateAsync({
          bottle: bottle.id,
          image: image === null ? null : undefined,
          ...data,
        });

        if (image) {
          try {
            const imageBlob = image ? await toBlob(image) : null;
            if (!imageBlob || imageBlob.size === 0) {
              throw new Error("Invalid image data");
            }
            
            await api.post(`/bottles/${bottle.id}/image`, {
              data: {
                image: imageBlob,
              },
            });
          } catch (err) {
            logError(err);
            flash(
              "Failed to upload image: " + (err.message || "Unknown error"),
              "error",
            );
          }
        }

        router.push(`/bottles/${bottleId}`);
      }}
      initialData={bottle}
      title="Edit Bottle"
    />
  );
}
