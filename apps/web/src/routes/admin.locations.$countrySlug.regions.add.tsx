import RegionForm from "@peated/web/components/admin/regionForm";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/admin/locations/$countrySlug/regions/add",
)({
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const { countrySlug } = Route.useParams();

  const orpc = useORPC();
  const regionCreateMutation = useMutation(
    orpc.regions.create.mutationOptions(),
  );

  return (
    <RegionForm
      onSubmit={async (data) => {
        const region = await regionCreateMutation.mutateAsync({
          ...data,
          country: countrySlug,
        });
        navigate({
          to: `/admin/locations/${region.country.slug}/regions/${region.slug}`,
        });
      }}
    />
  );
}
