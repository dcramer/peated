import { LoadingList } from "@peated/web/components";
import { PageHeader } from "@peated/web/components/pages/pageLayout.stylex";

export default function Loading() {
  return (
    <>
      <PageHeader title="Whisky events" />
      <LoadingList label="Loading events" rows={4} />
    </>
  );
}
