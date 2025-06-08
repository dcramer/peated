import Button from "@peated/web/components/button";
import CountryMapIcon from "@peated/web/components/countryMapIcon";
import Heading from "@peated/web/components/heading";
import Markdown from "@peated/web/components/markdown";
import PageHeader from "@peated/web/components/pageHeader";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { DefaultLayout } from "../layouts";

export const Route = createFileRoute("/locations/$countrySlug")({
  component: LocationLayoutPage,
});

function LocationLayoutPage() {
  const { countrySlug } = Route.useParams();
  const { user } = useAuth();
  const orpc = useORPC();
  const { data: country } = useSuspenseQuery(
    orpc.countries.details.queryOptions({
      input: {
        country: countrySlug,
      },
    })
  );

  const stats = [
    { name: "Distillers", value: country.totalDistillers.toLocaleString() },
    { name: "Bottles", value: country.totalBottles.toLocaleString() },
  ];

  return (
    <DefaultLayout>
      <PageHeader
        title={country.name}
        metadata={
          user?.mod && (
            <Button
              color="primary"
              to={`/admin/locations/${country.slug}/edit?returnTo=/locations/${country.slug}`}
            >
              Edit Location
            </Button>
          )
        }
      />

      <div className="my-6 grid grid-cols-3 items-center gap-3 text-center lg:grid-cols-4 lg:text-left">
        {stats.map((stat) => (
          <div key={stat.name}>
            <div className="text-muted leading-7">{stat.name}</div>
            <div className="order-first font-semibold text-3xl tracking-tight lg:text-5xl">
              {stat.value || "-"}
            </div>
          </div>
        ))}
      </div>

      {country.description && (
        <>
          <Heading as="h3">Whisky in {country.name}</Heading>
          <div className="flex">
            <div className="-mt-1 prose prose-invert max-w-none flex-auto">
              <Markdown content={country.description} />
            </div>
            <CountryMapIcon
              slug={country.slug}
              className="ml-8 hidden max-h-64 max-w-64 text-muted lg:block"
            />
          </div>
        </>
      )}

      <Tabs border>
        <TabItem as={Link} to={`/locations/${countrySlug}`} controlled>
          Distilleries
        </TabItem>
        <TabItem as={Link} to={`/locations/${countrySlug}/regions`} controlled>
          Regions
        </TabItem>
      </Tabs>

      <Outlet />
    </DefaultLayout>
  );
}
