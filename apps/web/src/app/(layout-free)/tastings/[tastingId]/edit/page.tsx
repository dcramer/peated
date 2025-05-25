"use client";

import { useFlashMessages } from "@peated/web/components/flash";
import TastingForm from "@peated/web/components/tastingForm";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page({
  params: { tastingId },
}: {
  params: { tastingId: string };
}) {
  useAuthRequired();

  const orpc = useORPC();

  // TODO: run these queries in parallel
  const { data: tasting } = useSuspenseQuery(
    orpc.tastings.details.queryOptions({
      input: { tasting: Number(tastingId) },
    }),
  );

  const { data: suggestedTags } = useSuspenseQuery(
    orpc.bottles.suggestedTags.queryOptions({
      input: { bottle: tasting.bottle.id },
    }),
  );

  const router = useRouter();

  const tastingUpdateMutation = useMutation(
    orpc.tastings.update.mutationOptions(),
  );
  const tastingImageUpdateMutation = useMutation(
    orpc.tastings.imageUpdate.mutationOptions(),
  );
  const { flash } = useFlashMessages();

  return (
    <TastingForm
      title="Edit Tasting"
      initialData={tasting}
      suggestedTags={suggestedTags}
      onSubmit={async ({ image, ...data }) => {
        await tastingUpdateMutation.mutateAsync({
          tasting: tasting.id,
          release: tasting.release?.id || null,
          image: image === null ? null : undefined,
          ...data,
        });

        if (image) {
          try {
            await tastingImageUpdateMutation.mutateAsync({
              tasting: tasting.id,
              file: await toBlob(image),
            });
          } catch (err) {
            logError(err);
            flash(
              "There was an error uploading your image, but the tasting was saved.",
              "error",
            );
          }
        }
        if (tasting) {
          router.push(`/tastings/${tasting.id}`);

          // TODO:
          // if (tasting.flight) {
          //   router.push(`/flights/${flightId}`);
          // } else {
          //   router.push(`/tastings/${tasting.id}`);
          // }
        }
      }}
    />
  );
}
