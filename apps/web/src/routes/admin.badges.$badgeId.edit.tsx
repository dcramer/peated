import BadgeForm from "@peated/web/components/admin/badgeForm";
import { useFlashMessages } from "@peated/web/components/flash";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute({
  component: Page,
});

function Page() {
  const { badgeId } = Route.useParams();
  const orpc = useORPC();
  const { data: badge } = useSuspenseQuery(
    orpc.badges.details.queryOptions({
      input: {
        badge: parseInt(badgeId, 10),
      },
    }),
  );

  const navigate = useNavigate();
  const badgeUpdateMutation = useMutation(orpc.badges.update.mutationOptions());
  const badgeImageUpdateMutation = useMutation(
    orpc.badges.imageUpdate.mutationOptions(),
  );
  const { flash } = useFlashMessages();

  return (
    <BadgeForm
      onSubmit={async ({ image, ...data }) => {
        const newBadge = await badgeUpdateMutation.mutateAsync({
          ...data,
          badge: badge.id,
        });

        if (image) {
          const blob = await toBlob(image);
          try {
            // TODO: switch to fetch maybe?
            await badgeImageUpdateMutation.mutateAsync({
              badge: newBadge.id,
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
        navigate({ to: `/admin/badges/${newBadge.id}` });
      }}
      edit
      title="Edit Badge"
      initialData={badge}
    />
  );
}
