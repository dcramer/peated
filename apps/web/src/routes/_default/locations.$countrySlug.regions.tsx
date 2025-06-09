import Table from "@peated/web/components/table";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_default/locations/$countrySlug/regions"
)({
  component: Page,
});

function Page() {
  const { countrySlug } = Route.useParams();
  const orpc = useORPC();
  const queryParams = useApiQueryParams({
    numericFields: ["cursor", "limit"],
    overrides: {
      country: countrySlug,
      sort: "-bottles",
      limit: 100,
    },
  });

  const { data: regionList } = useSuspenseQuery(
    orpc.regions.list.queryOptions({
      input: queryParams,
    })
  );

  return (
    <Table
      items={regionList.results}
      rel={regionList.rel}
      defaultSort="-bottles"
      url={(item) => `/locations/${countrySlug}/regions/${item.slug}`}
      columns={[
        { name: "name", sort: "name", sortDefaultOrder: "asc" },
        {
          name: "totalBottles",
          title: "Bottles",
          sort: "bottles",
        },
        {
          name: "totalDistillers",
          title: "Distillers",
          sort: "distillers",
        },
      ]}
    />
  );
}
