import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import PageHeader from "@peated/web/components/pageHeader";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/locations/$countrySlug")({
  component: AdminLocationLayoutPage,
});

function AdminLocationLayoutPage() {
  const { countrySlug } = Route.useParams();
  const orpc = useORPC();
  const { data: country } = useSuspenseQuery(
    orpc.countries.details.queryOptions({
      input: {
        country: countrySlug,
      },
    })
  );

  return (
    <div className="w-full p-3 lg:py-0">
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
            name: country.name,
            to: `/admin/locations/${country.slug}`,
            current: true,
          },
        ]}
      />

      <PageHeader
        title={country.name}
        metadata={
          <div className="flex gap-x-1">
            <Button to={`/admin/locations/${country.slug}/regions/add`}>
              Add Region
            </Button>
            <Button to={`/admin/locations/${country.slug}/edit`}>
              Edit Location
            </Button>
          </div>
        }
      />

      <Tabs border>
        <TabItem as={Link} to={`/admin/locations/${country.slug}`} controlled>
          Regions
        </TabItem>
      </Tabs>

      <Outlet />
    </div>
  );
}
