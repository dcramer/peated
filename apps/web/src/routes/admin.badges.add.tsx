import BadgeForm from "@peated/web/components/admin/badgeForm";
import { useFlashMessages } from "@peated/web/components/flash";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/badges/add")({
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const orpc = useORPC();
  const badgeCreateMutation = useMutation(orpc.badges.create.mutationOptions());
  const badgeImageUpdateMutation = useMutation(
    orpc.badges.imageUpdate.mutationOptions()
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
              "error"
            );
          }
        }
        navigate({ to: `/admin/badges/${badge.id}` });
      }}
      initialData={{ maxLevel: 25 }}
    />
  );
}
