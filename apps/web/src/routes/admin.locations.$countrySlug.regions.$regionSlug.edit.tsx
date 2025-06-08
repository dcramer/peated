import RegionForm from "@peated/web/components/admin/regionForm";
import { useModRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  returnTo: z.string().default(""),
});

export const Route = createFileRoute(
  "/admin/locations/$countrySlug/regions/$regionSlug/edit"
)({
  component: Page,
  validateSearch: searchSchema,
});

function Page() {
  useModRequired();

  const { countrySlug, regionSlug } = Route.useParams();
  const { returnTo } = Route.useSearch();
  const navigate = useNavigate();
  const orpc = useORPC();
  const { data: region } = useSuspenseQuery(
    orpc.regions.details.queryOptions({
      input: {
        country: countrySlug,
        region: regionSlug,
      },
    })
  );

  const queryClient = useQueryClient();

  const regionUpdateMutation = useMutation(
    orpc.regions.update.mutationOptions({
      onSuccess: (data) => {
        if (!data) return;
        // TODO: this might be wrong
        queryClient.setQueryData(
          orpc.regions.details.key({
            input: {
              country: countrySlug,
              region: data.slug,
            },
          }),
          (oldData: any) =>
            oldData
              ? {
                  ...oldData,
                  ...data,
                }
              : oldData
        );
      },
    })
  );

  return (
    <RegionForm
      onSubmit={async (data) => {
        await regionUpdateMutation.mutateAsync(
          {
            ...data,
            country: region.country.slug,
            region: region.slug,
          },
          {
            onSuccess: (result) => {
              if (returnTo) {
                navigate({ to: returnTo });
              } else {
                navigate({
                  to: `/locations/${result.country.slug}/regions/${result.slug}`,
                });
              }
            },
          }
        );
      }}
      edit
      initialData={region}
      title="Edit Region"
    />
  );
}
