import { ButtonLink, EmptyState } from "@peated/web/components";
import {
  PageHeader,
  PageSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import dayjs from "dayjs";
import type { Metadata } from "next";

import { EventList } from "./eventList.stylex";
import { getEventRegionPageState } from "./eventRegionData";
import { EventRegionFilter } from "./eventRegionFilter.stylex";

export const metadata: Metadata = {
  title: "Whisky events",
  description:
    "Major whisky festivals and shows, with dates and official websites.",
};

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string | string[] }>;
}) {
  const [{ client }, params] = await Promise.all([
    getAnonymousServerClient(),
    searchParams,
  ]);
  const eventList = await client.events.list({
    limit: 100,
    onlyUpcoming: true,
    sort: "date",
  });
  const regionState = getEventRegionPageState(eventList.results, params.region);
  const monthGroups = Map.groupBy(regionState.results, (event) =>
    dayjs(event.dateStart).format("YYYY-MM"),
  );

  return (
    <div>
      <PageHeader
        description="Major whisky festivals and shows, with dates and official websites."
        title="Whisky events"
      />
      {eventList.results.length ? (
        <EventRegionFilter
          options={regionState.options}
          selectedRegion={regionState.selectedRegion}
          total={eventList.results.length}
          visible={regionState.results.length}
        />
      ) : null}
      {regionState.results.length ? (
        [...monthGroups].map(([month, events]) => (
          <PageSection
            heading={dayjs(`${month}-01`).format("MMMM YYYY")}
            key={month}
          >
            <EventList events={events} />
          </PageSection>
        ))
      ) : (
        <PageSection heading="Upcoming events">
          <EmptyState
            action={
              regionState.selectedRegion ? (
                <ButtonLink href="/events" size="sm" variant="tonal">
                  View all events
                </ButtonLink>
              ) : undefined
            }
            heading={
              regionState.selectedRegion
                ? `No upcoming events in ${regionState.selectedRegion.label}`
                : "No upcoming events"
            }
          >
            {regionState.selectedRegion
              ? "There are no confirmed dates in this region."
              : "There are no confirmed dates to show."}
          </EmptyState>
        </PageSection>
      )}
    </div>
  );
}
