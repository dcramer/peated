"use client";

import TastingForm from "@peated/web/components/tastingForm";
import useApi from "@peated/web/hooks/useApi";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { trpc } from "@peated/web/lib/trpc";
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

  // capture this on initial load as its utilized to prevent
  // duplicate tasting submissions
  const createdAt = new Date().toISOString();

  return (
    <TastingForm
      title="Edit Tasting"
      initialData={tasting}
      suggestedTags={suggestedTags}
      onSubmit={async ({ picture, ...data }) => {
        await tastingUpdateMutation.mutateAsync({
          tasting: tasting.id,
          ...data,
          createdAt,
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
            // TODO show some kind of alert, ask them to reusubmit image
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
