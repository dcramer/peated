import BottleForm from "@peated/web/components/bottleForm";
import { useFlashMessages } from "@peated/web/components/flash";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { toBlob } from "@peated/web/lib/blobs";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_default/bottles/$bottleId/edit")({
  component: Page,
});

function Page() {
  useModRequired();

  const { bottleId } = Route.useParams();
  const orpc = useORPC();
  const { data: bottle } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({ input: { bottle: Number(bottleId) } })
  );
  const navigate = useNavigate();
  const bottleUpdateMutation = useMutation(
    orpc.bottles.update.mutationOptions()
  );
  const bottleImageUpdateMutation = useMutation(
    orpc.bottles.imageUpdate.mutationOptions()
  );
  const { flash } = useFlashMessages();

  return (
    <BottleForm
      onSubmit={async ({ image, ...data }) => {
        await bottleUpdateMutation.mutateAsync({
          bottle: bottle.id,
          image: image === null ? null : undefined,
          ...data,
        });

        if (image) {
          try {
            await bottleImageUpdateMutation.mutateAsync({
              bottle: bottle.id,
              file: await toBlob(image),
            });
          } catch (err) {
            logError(err);
            flash(
              "There was an error uploading your image, but the bottle was saved.",
              "error"
            );
          }
        }

        navigate({ to: `/bottles/${bottleId}` });
      }}
      initialData={bottle}
      title="Edit Bottle"
    />
  );
}
