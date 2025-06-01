import ReleaseForm from "@peated/web/components/releaseForm";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/bottles/$bottleId/releases/$releaseId/edit",
)({
  component: Page,
});

function Page() {
  useModRequired();

  const { bottleId, releaseId } = Route.useParams();
  const orpc = useORPC();
  const { data: bottle } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({ input: { bottle: Number(bottleId) } }),
  );
  const { data: release } = useSuspenseQuery(
    orpc.bottleReleases.details.queryOptions({
      input: { release: Number(releaseId) },
    }),
  );
  const navigate = useNavigate();
  const bottleReleaseUpdateMutation = useMutation(
    orpc.bottleReleases.update.mutationOptions(),
  );

  return (
    <ReleaseForm
      bottle={bottle}
      onSubmit={async (data) => {
        await bottleReleaseUpdateMutation.mutateAsync({
          release: release.id,
          ...data,
        });

        navigate({ to: `/bottles/${bottleId}/releases` });
      }}
      initialData={release}
      title="Edit Bottle Release"
    />
  );
}
