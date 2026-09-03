import { LoadingList } from "@peated/web/components";
import { PageHeader } from "@peated/web/components/pages/pageLayout.stylex";

export default function Loading() {
  return (
    <>
      <PageHeader title="Flights" />
      <LoadingList label="Loading flights" rows={4} />
    </>
  );
}
