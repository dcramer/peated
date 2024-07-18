"use client";

import Button from "@peated/web/components/button";
import PageHeader from "@peated/web/components/pageHeader";
import Table from "@peated/web/components/table";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc/client";

export default function Page() {
  useAuthRequired();

  const [flightList] = trpc.flightList.useSuspenseQuery();

  return (
    <>
      <PageHeader
        title="Flights"
        metadata={
          <Button color="primary" href="/addFlight">
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
                <div className="text-light">{item.description ?? ""}</div>
              </>
            ),
          },
        ]}
      />
    </>
  );
}
