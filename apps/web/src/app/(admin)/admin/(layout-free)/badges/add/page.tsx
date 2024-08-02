"use client";

import BadgeForm from "@peated/web/components/admin/badgeForm";
import { useFlashMessages } from "@peated/web/components/flash";
import useApi from "@peated/web/hooks/useApi";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { trpc } from "@peated/web/lib/trpc/client";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const badgeCreateMutation = trpc.badgeCreate.useMutation();
  const api = useApi();
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
            // TODO: switch to fetch maybe?
            await api.post(`/badges/${badge.id}/image`, {
              data: {
                image: blob,
              },
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
