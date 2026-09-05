import { ButtonLink, EmptyState } from "@peated/web/components";
import {
  PageHeader,
  PageSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { redirectToAuth } from "@peated/web/lib/auth";
import { isLoggedIn } from "@peated/web/lib/auth.server";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import type { Metadata } from "next";
import { Suspense } from "react";

import { FlightList, FlightListLoading } from "./flightList";

export const metadata: Metadata = { title: "Flights" };

export default async function FlightsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await isLoggedIn())) return redirectToAuth({ pathname: "/flights" });

  const searchParams = await props.searchParams;
  const queryParams = getApiQueryParams(searchParams, {
    defaults: { sort: "name" },
    numericFields: ["cursor", "limit"],
    overrides: { limit: 50 },
  });

  return (
    <div>
      <PageHeader
        actions={
          <ButtonLink href="/addFlight" size="md" variant="accent">
            Create a flight
          </ButtonLink>
        }
        description="Group bottles for a side-by-side tasting."
        title="Flights"
      />
      <PageSection heading="Your flights">
        <Suspense
          key={String(queryParams.cursor ?? 1)}
          fallback={<FlightListLoading />}
        >
          <FlightResults
            queryParams={queryParams}
            searchParams={searchParams}
          />
        </Suspense>
      </PageSection>
    </div>
  );
}

async function FlightResults({
  queryParams,
  searchParams,
}: {
  queryParams: ReturnType<typeof getApiQueryParams>;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { client } = await getServerClient();
  const flightList = await client.flights.list(queryParams);
  const page = Number(queryParams.cursor ?? 1) || 1;

  return flightList.results.length ? (
    <FlightList
      flightList={flightList}
      page={page}
      searchParams={searchParams}
    />
  ) : (
    <EmptyState
      action={
        <ButtonLink href="/addFlight" size="sm" variant="accent">
          Create a flight
        </ButtonLink>
      }
      heading="Build your first flight"
    >
      Group bottles into a side-by-side tasting and compare what stands out.
    </EmptyState>
  );
}
