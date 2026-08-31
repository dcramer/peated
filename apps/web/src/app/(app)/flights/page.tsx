import {
  ButtonLink,
  CursorPager,
  EmptyState,
  ItemList,
  ItemRow,
} from "@peated/web/components";
import {
  PageHeader,
  PageSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { redirectToAuth } from "@peated/web/lib/auth";
import { isLoggedIn } from "@peated/web/lib/auth.server";
import { getCursorHref } from "@peated/web/lib/cursorHref";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import type { Metadata } from "next";

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
  const { client } = await getServerClient();
  const flightList = await client.flights.list(queryParams);
  const page = Number(queryParams.cursor ?? 1) || 1;

  return (
    <div>
      <PageHeader
        actions={
          <ButtonLink href="/addFlight" size="md" variant="accent">
            Create a flight
          </ButtonLink>
        }
        description="Group bottles for a side-by-side tasting."
        eyebrow="Your record"
        title="Flights"
      />
      <PageSection heading="Your flights">
        {flightList.results.length ? (
          <ItemList ariaLabel="Tasting flights">
            {flightList.results.map((flight) => (
              <ItemRow
                description={flight.description}
                href={`/flights/${flight.id}`}
                key={flight.id}
                metadata={flight.public ? "Public" : "Private"}
                title={flight.name}
              />
            ))}
          </ItemList>
        ) : (
          <EmptyState
            action={
              <ButtonLink href="/addFlight" size="sm" variant="accent">
                Create a flight
              </ButtonLink>
            }
            heading="Build your first flight"
          >
            Group bottles into a side-by-side tasting and compare what stands
            out.
          </EmptyState>
        )}
        <CursorPager
          ariaLabel="Flight pages"
          nextHref={getCursorHref(
            "/flights",
            searchParams,
            flightList.rel.nextCursor,
          )}
          page={page}
          previousHref={getCursorHref(
            "/flights",
            searchParams,
            flightList.rel.prevCursor,
          )}
        />
      </PageSection>
    </div>
  );
}
