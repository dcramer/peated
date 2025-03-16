"use client";

import BadgeImage from "@peated/web/components/badgeImage";
import { useFlashMessages } from "@peated/web/components/flash";
import Link from "@peated/web/components/link";
import TastingForm from "@peated/web/components/tastingForm";
import useApi from "@peated/web/hooks/useApi";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { trpc } from "@peated/web/lib/trpc/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function AddTasting({
  params: { bottleId, releaseId },
}: {
  params: { bottleId: string; releaseId?: string };
}) {
  useAuthRequired();

  const router = useRouter();

  const [bottle] = trpc.bottleById.useSuspenseQuery(Number(bottleId));
  const [release] = releaseId
    ? trpc.bottleReleaseById.useSuspenseQuery(Number(releaseId))
    : [null];
  const [suggestedTags] = trpc.bottleSuggestedTagList.useSuspenseQuery({
    bottle: Number(bottleId),
  });

  const qs = useSearchParams();
  const flightId = qs.get("flight") || null;
  const [flight] = flightId
    ? trpc.flightById.useSuspenseQuery(flightId)
    : [null];

  const tastingCreateMutation = trpc.tastingCreate.useMutation();
  const api = useApi();

  // capture this on initial load as its utilized to prevent
  // duplicate tasting submissions
  const createdAt = new Date().toISOString();

  const { flash } = useFlashMessages();

  return (
    <TastingForm
      title="Record Tasting"
      initialData={{ bottle, release }}
      suggestedTags={suggestedTags}
      onSubmit={async ({ image, ...data }) => {
        const { tasting, awards } = await tastingCreateMutation.mutateAsync({
          ...data,
          flight: flight?.id || null,
          createdAt,
        });

        if (tasting) {
          if (image) {
            try {
              await api.post(`/tastings/${tasting.id}/image`, {
                data: {
                  image: image ? await toBlob(image) : null,
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

          for (const award of awards) {
            // TODO: show "Youve discovered" flow for level 0 badges
            if (award.level != award.prevLevel && award.level) {
              flash(
                <div className="relative flex flex-row items-center gap-x-3">
                  <Link
                    href={`/badges/${award.badge.id}`}
                    className="absolute inset-0"
                  />
                  <BadgeImage
                    badge={award.badge}
                    size={48}
                    level={award.level}
                  />
                  <div className="flex flex-col">
                    <h5 className="font-semibold">{award.badge.name}</h5>
                    <p className="font-normal">
                      You've reached level {award.level}!
                    </p>
                  </div>
                </div>,
                "info",
              );
            }
          }
          if (flightId) {
            router.push(`/flights/${flightId}`);
          } else {
            router.push(`/tastings/${tasting.id}`);
          }
        }
      }}
    />
  );
}
