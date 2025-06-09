import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Button from "@peated/web/components/button";
import PageHeader from "@peated/web/components/pageHeader";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_default/admin/locations/$countrySlug")({
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
            <Button asChild>
              <Link
                to="/admin/locations/$countrySlug/regions/add"
                params={{ countrySlug: country.slug }}
              >
                Add Region
              </Link>
            </Button>
            <Button asChild>
              <Link
                to="/admin/locations/$countrySlug/edit"
                params={{ countrySlug: country.slug }}
              >
                Edit Location
              </Link>
            </Button>
          </div>
        }
      />

      <Tabs border>
        <TabItem asChild controlled>
          <Link
            to="/admin/locations/$countrySlug"
            params={{ countrySlug: country.slug }}
          >
            Regions
          </Link>
        </TabItem>
      </Tabs>

      <Outlet />
    </div>
  );
}
