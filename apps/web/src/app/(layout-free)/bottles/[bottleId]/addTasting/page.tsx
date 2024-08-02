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

  const { flash } = useFlashMessages();

  return (
    <TastingForm
      title="Record Tasting"
      initialData={{ bottle }}
      suggestedTags={suggestedTags}
      onSubmit={async ({ picture, ...data }) => {
        const { tasting, awards } = await tastingCreateMutation.mutateAsync({
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
            flash(
              "There was an error uploading your image, but the tasting was saved.",
              "error",
            );
          }
        }
        if (tasting) {
          for (const award of awards) {
            if (award.level != award.prevLevel) {
              flash(
                <div className="relative flex flex-row items-center gap-x-3">
                  <Link
                    href={`/badges/${award.badge.id}`}
                    className="absolute inset-0"
                  />
                  <BadgeImage badge={award.badge} size={48} />
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
