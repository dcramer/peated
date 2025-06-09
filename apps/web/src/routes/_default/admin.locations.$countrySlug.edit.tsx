import CountryForm from "@peated/web/components/admin/countryForm";
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
  returnTo: z.string().optional(),
});

export const Route = createFileRoute(
  "/_default/admin/locations/$countrySlug/edit"
)({
  component: Page,
  validateSearch: searchSchema,
});

function Page() {
  useModRequired();

  const { countrySlug } = Route.useParams();
  const orpc = useORPC();
  const { data: country } = useSuspenseQuery(
    orpc.countries.details.queryOptions({
      input: { country: countrySlug },
    })
  );

  const navigate = useNavigate();
  const search = Route.useSearch();
  const returnTo = search.returnTo;

  const queryClient = useQueryClient();

  const countryUpdateMutation = useMutation(
    orpc.countries.update.mutationOptions({
      onSuccess: (data) => {
        if (!data) return;
        // TODO: this might be wrong
        queryClient.setQueryData(
          orpc.countries.details.key({
            input: { country: data.slug },
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
    <CountryForm
      onSubmit={async (data) => {
        await countryUpdateMutation.mutateAsync(
          {
            ...data,
            country: country.slug,
          },
          {
            onSuccess: (result) => {
              if (returnTo) navigate({ to: returnTo });
              else navigate({ to: `/locations/${result.slug}` });
            },
          }
        );
      }}
      edit
      initialData={country}
      title="Edit Location"
    />
  );
}
