"use client";

import BadgeForm from "@peated/web/components/admin/badgeForm";
import { useFlashMessages } from "@peated/web/components/flash";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const orpc = useORPC();
  const badgeCreateMutation = useMutation(orpc.badges.create.mutationOptions());
  const badgeImageUpdateMutation = useMutation(
    orpc.badges.imageUpdate.mutationOptions(),
  );
  const { flash } = useFlashMessages();

  return (
    <BadgeForm
      onSubmit={async ({ image, ...data }) => {
        const badge = await badgeCreateMutation.mutateAsync({
          ...data,
        });

        if (image) {
          const blob = await toBlob(image);
          try {
            await badgeImageUpdateMutation.mutateAsync({
              badge: badge.id,
              file: blob,
            });
          } catch (err) {
            logError(err);
            flash(
              "There was an error uploading your image, but we saved the badge.",
              "error",
            );
          }
        }
        router.push(`/admin/badges/${badge.id}`);
      }}
      initialData={{ maxLevel: 25 }}
    />
  );
}
