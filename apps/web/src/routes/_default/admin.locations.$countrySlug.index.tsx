import Table from "@peated/web/components/table";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_default/admin/locations/$countrySlug/")(
  {
    component: Page,
  }
);

function Page() {
  const { countrySlug } = Route.useParams();
  const queryParams = useApiQueryParams({
    defaults: {
      sort: "-created",
    },
    numericFields: ["cursor", "limit"],
    overrides: {
      country: countrySlug,
    },
  });

  const orpc = useORPC();
  const { data: regionList } = useSuspenseQuery(
    orpc.regions.list.queryOptions({
      input: {
        country: countrySlug,
        ...queryParams,
      },
    })
  );

  return (
    <div>
      <Table
        items={regionList.results}
        rel={regionList.rel}
        defaultSort="-created"
        url={(item) => `/admin/locations/${countrySlug}/regions/${item.slug}`}
        columns={[{ name: "name", sort: "name", sortDefaultOrder: "asc" }]}
      />
    </div>
  );
}
