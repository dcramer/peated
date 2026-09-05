import { PageSection } from "@peated/web/components/pages/pageLayout.stylex";

import { EventListLoading } from "./eventList.stylex";
import { EventRegionFilterLoading } from "./eventRegionFilter.stylex";

export function EventResultsLoading() {
  return (
    <>
      <EventRegionFilterLoading />
      <PageSection heading="Upcoming events">
        <EventListLoading />
      </PageSection>
    </>
  );
}
