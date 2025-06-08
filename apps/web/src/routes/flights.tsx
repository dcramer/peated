import Button from "@peated/web/components/button";
import PageHeader from "@peated/web/components/pageHeader";
import Table from "@peated/web/components/table";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DefaultLayout } from "../layouts";

export const Route = createFileRoute("/flights")({
  component: Page,
});

function Page() {
  useAuthRequired();
  const orpc = useORPC();

  const { data: flightList } = useSuspenseQuery(
    orpc.flights.list.queryOptions()
  );

  return (
    <DefaultLayout>
      <PageHeader
        title="Flights"
        metadata={
          <Button color="primary" to="/addFlight">
            Add Flight
          </Button>
        }
      />
      <Table
        items={flightList.results}
        rel={flightList.rel}
        defaultSort="name"
        url={(item) => `/flights/${item.id}`}
        columns={[
          {
            name: "name",
            sort: "name",
            sortDefaultOrder: "asc",
            value: (item) => (
              <>
                <div className="font-bold group-hover:underline">
                  {item.name}
                </div>
                <div className="text-muted">{item.description ?? ""}</div>
              </>
            ),
          },
        ]}
      />
    </DefaultLayout>
  );
}
