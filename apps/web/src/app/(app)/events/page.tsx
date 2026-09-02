import { EmptyState } from "@peated/web/components";
import {
  PageHeader,
  PageSection,
} from "@peated/web/components/pages/pageLayout.stylex";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import dayjs from "dayjs";
import type { Metadata } from "next";

import { EventList } from "./eventList.stylex";

export const metadata: Metadata = {
  title: "Whisky events",
  description:
    "Major whisky festivals and shows, with dates and official websites.",
};

export default async function EventsPage() {
  const { client } = await getAnonymousServerClient();
  const eventList = await client.events.list({
    limit: 100,
    onlyUpcoming: true,
    sort: "date",
  });
  const monthGroups = Map.groupBy(eventList.results, (event) =>
    dayjs(event.dateStart).format("YYYY-MM"),
  );

  return (
    <div>
      <PageHeader
        description="Major whisky festivals and shows, with dates and official websites."
        eyebrow="Whisky calendar"
        title="Whisky events"
      />
      {eventList.results.length ? (
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
          <EmptyState heading="No upcoming events">
            There are no confirmed dates to show.
          </EmptyState>
        </PageSection>
      )}
    </div>
  );
}
