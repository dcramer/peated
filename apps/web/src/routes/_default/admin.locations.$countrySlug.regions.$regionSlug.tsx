import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import PageHeader from "@peated/web/components/pageHeader";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_default/admin/locations/$countrySlug/regions/$regionSlug"
)({
  component: Page,
});

function Page() {
  const { countrySlug, regionSlug } = Route.useParams();
  const orpc = useORPC();
  const { data: region } = useSuspenseQuery(
    orpc.regions.details.queryOptions({
      input: { country: countrySlug, region: regionSlug },
    })
  );

  return (
    <div>
      <Breadcrumbs
        pages={[
          {
            name: "Admin",
            to: "/admin",
          },
          {
            name: "Locations",
            to: "/admin/locations",
          },
          {
            name: region.country.name,
            to: `/admin/locations/${region.country.slug}`,
          },
          {
            name: region.name,
            to: `/admin/locations/${region.country.slug}/regions/${region.slug}`,
            current: true,
          },
        ]}
      />

      <PageHeader
        title={region.name}
        metadata={
          <Button
            to="/admin/locations/$countrySlug/regions/$regionSlug/edit"
            params={{
              countrySlug: region.country.slug,
              regionSlug: region.slug,
            }}
          >
            Edit
          </Button>
        }
      />
    </div>
  );
}
