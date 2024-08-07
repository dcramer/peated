"use client";

import { useFlashMessages } from "@peated/web/components/flash";
import TastingForm from "@peated/web/components/tastingForm";
import useApi from "@peated/web/hooks/useApi";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { trpc } from "@peated/web/lib/trpc/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function Page({
  params: { tastingId },
}: {
  params: { tastingId: string };
}) {
  useAuthRequired();

  const [tasting] = trpc.tastingById.useSuspenseQuery(Number(tastingId));
  const [suggestedTags] = trpc.bottleSuggestedTagList.useSuspenseQuery({
    bottle: tasting.bottle.id,
  });

  const router = useRouter();
  const searchParams = useSearchParams();
  const flight = searchParams.get("flight") || null;

  const tastingUpdateMutation = trpc.tastingUpdate.useMutation();
  const api = useApi();
  const { flash } = useFlashMessages();

  return (
    <TastingForm
      title="Edit Tasting"
      initialData={tasting}
      suggestedTags={suggestedTags}
      onSubmit={async ({ picture, ...data }) => {
        await tastingUpdateMutation.mutateAsync({
          tasting: tasting.id,
          ...data,
        });

        if (picture) {
          const blob = await toBlob(picture);
          try {
            // TODO: switch to fetch maybe?
            await api.post(`/tastings/${tasting.id}/image`, {
              data: {
                image: blob,
              },
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
          if (flight) {
            router.push(`/flights/${flight}`);
          } else {
            router.push(`/tastings/${tasting.id}`);
          }
        }
      }}
    />
  );
}
