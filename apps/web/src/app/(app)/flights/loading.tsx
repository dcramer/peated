import {
  PageHeader,
  PageSection,
} from "@peated/web/components/pages/pageLayout.stylex";

import { FlightListLoading } from "./flightList";

export default function Loading() {
  return (
    <div>
      <PageHeader
        description="Group bottles for a side-by-side tasting."
        title="Flights"
      />
      <PageSection heading="Your flights">
        <FlightListLoading />
      </PageSection>
    </div>
  );
}
