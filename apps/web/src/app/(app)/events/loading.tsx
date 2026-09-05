import { PageHeader } from "@peated/web/components/pages/pageLayout.stylex";
import { EventResultsLoading } from "./eventResultsLoading";

export default function Loading() {
  return (
    <div>
      <PageHeader
        description="Major whisky festivals and shows, with dates and official websites."
        title="Whisky events"
      />
      <EventResultsLoading />
    </div>
  );
}
