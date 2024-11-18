"use client";
import { use } from "react";

import BadgeForm from "@peated/web/components/admin/badgeForm";
import { useFlashMessages } from "@peated/web/components/flash";
import useApi from "@peated/web/hooks/useApi";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { trpc } from "@peated/web/lib/trpc/client";
import { useRouter } from "next/navigation";

export default function Page(props: { params: Promise<{ badgeId: string }> }) {
  const params = use(props.params);

  const { badgeId } = params;

  const [badge] = trpc.badgeById.useSuspenseQuery(parseInt(badgeId, 10));

  const router = useRouter();
  const badgeUpdateMutation = trpc.badgeUpdate.useMutation();
  const api = useApi();
  const { flash } = useFlashMessages();

  return (
    <BadgeForm
      onSubmit={async ({ image, ...data }) => {
        const newBadge = await badgeUpdateMutation.mutateAsync({
          ...data,
          id: badge.id,
        });

        if (image) {
          const blob = await toBlob(image);
          try {
            // TODO: switch to fetch maybe?
            await api.post(`/badges/${newBadge.id}/image`, {
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
        router.push(`/admin/badges/${newBadge.id}`);
      }}
      edit
      title="Edit Badge"
      initialData={badge}
    />
  );
}
