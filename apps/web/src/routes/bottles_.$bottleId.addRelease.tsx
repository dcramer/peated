import { toTitleCase } from "@peated/server/lib/strings";
import ReleaseForm from "@peated/web/components/releaseForm";
import { useVerifiedRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  name: z.string().optional(),
  returnTo: z.string().optional(),
});

export const Route = createFileRoute("/bottles_/$bottleId/addRelease")({
  component: Page,
  validateSearch: searchSchema,
});

function Page() {
  useVerifiedRequired();

  const { bottleId } = Route.useParams();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const name = toTitleCase(search.name || "");
  const returnTo = search.returnTo;

  const orpc = useORPC();
  const { data: bottle } = useSuspenseQuery(
    orpc.bottles.details.queryOptions({ input: { bottle: Number(bottleId) } })
  );

  const bottleReleaseCreateMutation = useMutation(
    orpc.bottleReleases.create.mutationOptions()
  );

  if (!bottle) return null;

  return (
    <ReleaseForm
      bottle={bottle}
      onSubmit={async ({ image, ...data }) => {
        const newRelease = await bottleReleaseCreateMutation.mutateAsync({
          bottle: Number(bottleId),
          ...data,
        });

        if (returnTo) navigate({ to: returnTo });
        else
          navigate({
            to: "/bottles/$bottleId/releases",
            params: { bottleId },
          });
      }}
      initialData={{
        edition: name,
      }}
      title="Add Release"
    />
  );
}
