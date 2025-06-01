import { Breadcrumbs } from "@peated/web/components/breadcrumbs";
import Table from "@peated/web/components/table";
import useApiQueryParams from "@peated/web/hooks/useApiQueryParams";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/locations")({
  component: Page,
});

function Page() {
  const queryParams = useApiQueryParams({
    defaults: {
      sort: "-created",
    },
    numericFields: ["cursor", "limit"],
  });

  const orpc = useORPC();
  const { data: countryList } = useSuspenseQuery(
    orpc.countries.list.queryOptions({
      input: queryParams,
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
            current: true,
          },
        ]}
      />

      <Table
        items={countryList.results}
        rel={countryList.rel}
        defaultSort="-created"
        url={(item) => `/admin/locations/${item.slug}`}
        columns={[{ name: "name", sort: "name", sortDefaultOrder: "asc" }]}
        withSearch
      />
    </div>
  );
}
