"use client";

import TastingForm from "@peated/web/components/tastingForm";
import useApi from "@peated/web/hooks/useApi";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { trpc } from "@peated/web/lib/trpc";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AddTasting({
  params: { bottleId },
}: {
  params: { bottleId: string };
}) {
  useAuthRequired();

  const router = useRouter();

  const [bottle] = trpc.bottleById.useSuspenseQuery(Number(bottleId));
  const [suggestedTags] = trpc.bottleSuggestedTagList.useSuspenseQuery({
    bottle: Number(bottleId),
  });

  const qs = useSearchParams();
  const flight = qs.get("flight") || null;

  const tastingCreateMutation = trpc.tastingCreate.useMutation();
  const api = useApi();

  // capture this on initial load as its utilized to prevent
  // duplicate tasting submissions
  const createdAt = new Date().toISOString();

  return (
    <TastingForm
      title="Record Tasting"
      initialData={{ bottle }}
      suggestedTags={suggestedTags}
      onSubmit={async ({ picture, ...data }) => {
        const tasting = await tastingCreateMutation.mutateAsync({
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
