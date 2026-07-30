"use client";

import Button from "@peated/web/components/button";
import PageHeader from "@peated/web/components/pageHeader";
import Table from "@peated/web/components/table";
import { AuthRequired } from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Page() {
  return (
    <AuthRequired>
      <FlightsPage />
    </AuthRequired>
  );
}

function FlightsPage() {
  const orpc = useORPC();

  const { data: flightList } = useSuspenseQuery(
    orpc.flights.list.queryOptions(),
  );

  return (
    <>
      <PageHeader
        title="Flights"
        metadata={
          flightList.results.length ? (
            <Button color="primary" href="/addFlight">
              Add Flight
            </Button>
          ) : null
        }
      />
      {flightList.results.length ? (
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
      ) : (
        <div className="relative mx-3 min-h-56 overflow-hidden border border-slate-800 bg-slate-950 px-6 py-8 sm:mx-0 sm:px-10 sm:py-10">
          <img
            src="/assets/empty-flights-illustration.webp"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-right"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-slate-950/5"
            aria-hidden="true"
          />
          <div className="relative z-10 max-w-[65%] sm:max-w-sm">
            <h2 className="text-xl font-bold text-white">
              Build your first flight
            </h2>
            <p className="text-muted mt-2 text-sm">
              Group bottles into a side-by-side tasting and compare what stands
              out.
            </p>
            <div className="mt-5">
              <Button color="highlight" href="/addFlight">
                Create a flight
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
