import Table from "@peated/web/components/table";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute({
  component: Page,
});

function Page() {
  const orpc = useORPC();
  const { data: countryList } = useSuspenseQuery(
    orpc.countries.list.queryOptions({
      input: {
        hasBottles: true,
        sort: "-bottles",
      },
    }),
  );

  return (
    <Table
      items={countryList.results}
      rel={countryList.rel}
      defaultSort="-bottles"
      url={(item) => `/locations/${item.slug}`}
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
